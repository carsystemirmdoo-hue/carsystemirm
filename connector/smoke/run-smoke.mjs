/**
 * Windows smoke runner — PRVI prolaz na kancelarijskom računaru.
 *
 * Šta radi: pokreće STVARNE, već postojeće testove i STVARNI entrypoint
 * konektora iz ovog paketa, u izolovanom folderu, sa sintetičkim PDF-ovima.
 *
 * Šta NE radi: ne šalje ništa na mrežu, ne registruje uređaj, ne uključuje
 * nijedan feature gate, ne pravi Scheduled Task, servis, registry unos ni
 * autostart, i ne dodiruje BizniSoft/Downloads/Documents.
 *
 * Ne čisti za sobom. Rezultat i lokalno stanje ostaju za proveru; brisanje je
 * zasebna, izričita komanda (`RUN-SMOKE.cmd cleanup`).
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { arch, platform, release, tmpdir, version as osVersion } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OVDE = dirname(fileURLToPath(import.meta.url));
const PAKET = resolve(OVDE, "..");
const DIST = join(PAKET, "connector", "dist");
const TESTOVI = join(PAKET, "connector", "test");
const WINDOWS = join(PAKET, "connector", "windows");
const FIXTURES = join(PAKET, "fixtures", "dev", "biznisoft");
const META = JSON.parse(readFileSync(join(OVDE, "package-meta.json"), "utf8"));

/** Runtime ugovor živi u zasebnom modulu, da bi bio testabilan van Windows-a. */
const { oceniRuntime, testiraniMajor } = await import("./runtime-contract.mjs");

/** Ocena poziva .ps1 (vreme, izlaz, oznaka) — isti modul koriste i [WIN] testovi. */
const { oceniPozivSkripte, zadatakPremaSchtasks } = await import(pathToFileURL(join(TESTOVI, "task-poziv.mjs")).href);

/* =========================================================================
 * Izveštavanje
 * ====================================================================== */

const nalazi = [];
/** Ključne provere: SKIP na bilo kojoj od njih daje INCOMPLETE, ne PASS. */
const KLJUCNE = new Set(["W05", "W06", "W07", "W10", "W14", "W15-win"]);

/*
 * RUČNE provere — odvojene od automatskog smoke-a.
 *
 * Ranije su bile `[WIN]` testovi koji sami sebe preskaču, a `W15-win` je
 * dozvoljavao najviše jedan preskok. Sa dva takva testa automatski smoke
 * NIJE MOGAO da vrati `SMOKE PASS` ni na ispravnoj mašini (kancelarija
 * 45a3460: „izvršeno 13/15").
 *
 * Sada se ne izvršavaju, ne broje kao [WIN] testovi i ne utiču na ishod
 * automatskog prolaza — ali se u rezultatu uvek prijavljuju kao
 * `MANUAL_NOT_EXECUTED`, da niko ne pročita `SMOKE PASS` kao da su urađene.
 * Runner ih NIKAD ne pokreće: obe menjaju sistem ili traže drugi nalog.
 */
const RUCNO_NIJE_IZVRSENO = "MANUAL_NOT_EXECUTED";
const RUCNE_PROVERE = [
  {
    id: "RUCNO-DPAPI-NALOG",
    naziv: "DPAPI ključ jednog Windows naloga ne otključava se pod drugim nalogom",
    postupak: "traži drugi Windows nalog i pokretanje pod njim; vidi smoke/START-HERE.md §8, Ručne provere",
  },
  {
    id: "RUCNO-TASK-APPLY",
    naziv: "registracija i uklanjanje Scheduled Task-a (-Apply, Smoke i Production)",
    postupak:
      "menja Task Scheduler; samo na izolovanom Windows okruženju: task.ps1 -Action install -Mode Smoke -Apply / " +
      "-Mode Production -Apply, pa -Action uninstall za oba; potvrditi dva različita imena zadatka " +
      "(CarsystemConnectorSMOKE, CarsystemConnector) i da uklanjanje jednog ne dira drugi",
  },
];

function zabelezi(id, naziv, status, detalj = "", kod = null) {
  nalazi.push({ id, naziv, status, detalj, kod });
  const oznaka = { PASS: "PASS ", FAIL: "FAIL ", SKIP: "SKIP " }[status] ?? status;
  console.log(`${oznaka} ${id}  ${naziv}${detalj ? " :: " + detalj : ""}`);
}

/**
 * Izvršava jednu proveru; izuzetak je FAIL, ne prekid prolaza.
 *
 * Poruka izuzetka se NE ispisuje sirova: ume da nosi punu putanju i korisničko
 * ime. Provera vraća kratak, bezbedan kod.
 */
function provera(id, naziv, fn) {
  try {
    const r = fn();
    if (r && r.skip) zabelezi(id, naziv, "SKIP", r.detalj ?? "", r.kod ?? "skipped");
    else zabelezi(id, naziv, "PASS", (r && r.detalj) || "");
  } catch (e) {
    /*
     * FAIL nosi detalj kao i PASS.
     *
     * Prvi stvarni prolaz je vratio devet padova sa praznim detaljem i samo
     * šifrom; iz takvog izveštaja se ne vidi ni šta je izmereno ni šta je
     * očekivano, pa je svaka dijagnoza bila nagađanje. Detalj prolazi kroz
     * `redigovan` pri upisu, kao i sve ostalo.
     */
    zabelezi(id, naziv, "FAIL", (e && e.detalj) || "", (e && e.kod) || "unexpected_error");
  }
}

class Pad extends Error {
  constructor(kod, detalj = "") {
    super(kod);
    this.kod = kod;
    this.detalj = detalj;
  }
}
const pad = (kod, detalj = "") => {
  throw new Pad(kod, detalj);
};

/* =========================================================================
 * Redakcija
 * ====================================================================== */

/**
 * Sve što ide u rezultat prolazi ovuda.
 *
 * Rezultat se šalje van ovog računara, pa ne sme nositi korisničko ime, ime
 * mašine, punu putanju, ključ, potpis ni sadržaj dokumenta.
 */
const SUMNJIVO = [
  /[A-Za-z]:\\[^\s"']+/g,          // apsolutna Windows putanja
  /\/(?:Users|home)\/[^\s"']+/g,   // apsolutna POSIX putanja
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // e-pošta
  /[A-Za-z0-9+/]{80,}={0,2}/g,     // dugačak base64 (ključ, potpis, telo)
  /-----BEGIN [^-]+-----/g,
];
function redigovan(tekst) {
  let t = String(tekst);
  for (const r of SUMNJIVO) t = t.replace(r, "[redigovano]");
  return t;
}

/** Dugačak base64 u izlazu znači da je nešto tajno procurilo. */
function nemaTajni(tekst) {
  return !/[A-Za-z0-9+/]{80,}={0,2}/.test(String(tekst)) && !/BEGIN [A-Z ]*PRIVATE KEY/.test(String(tekst));
}

/* =========================================================================
 * Izolovano okruženje
 * ====================================================================== */

/*
 * Folder namerno nosi razmake i srpska slova.
 *
 * Windows putanja sa `ČĆŽŠĐ` i razmakom je tipičan uzrok kvara koji se na
 * macOS-u nikad ne vidi; ako nešto pukne, treba da pukne ovde, a ne kasnije
 * nad stvarnim folderom kancelarije.
 */
const SMOKE = join(tmpdir(), "Carsystem Smoke ČĆŽŠĐ");
const STANJE = join(SMOKE, "stanje uređaja");
const ULAZ = join(SMOKE, "sintetički ulaz");
const KONFIG = join(SMOKE, "config.json");
const PRAZAN = join(SMOKE, "bez konfiguracije");

function okruzenje(dodatno = {}) {
  return {
    ...process.env,
    CS_CONNECTOR_STATE_DIR: STANJE,
    CS_CONNECTOR_CONFIG: KONFIG,
    // Paket sam postavlja CS_CONNECTOR_PACKAGED=1 kroz connector.cmd.
    ...dodatno,
  };
}

/** Poziva spakovani `connector.cmd` — isti put kojim ide i Task Scheduler. */
function konektor(args, { env = okruzenje(), timeout = 120000 } = {}) {
  const r = spawnSync("cmd.exe", ["/c", join(DIST, "connector.cmd"), ...args], {
    encoding: "utf8",
    timeout,
    env,
  });
  return {
    kod: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    istekao: r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM",
  };
}

const json = (tekst) => {
  try {
    return JSON.parse(tekst);
  } catch {
    return null;
  }
};

/**
 * Efektivna politika izvršavanja, u jednom redu.
 *
 * Samo naziv politike i opseg — nijedna putanja, nijedno ime naloga. Bez ovoga
 * `task_script_failed` ne kaže ništa upotrebljivo, a upravo je taj prazan detalj
 * u prvom prolazu učinio nalaz nedijagnostikovanim.
 */
function politikaOpis() {
  const r = powershell(["-Command", "Get-ExecutionPolicy -List | Out-String"], 30000);
  if (r.kod !== 0) return "efektivna politika nije očitana";
  const redovi = r.stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => /^(MachinePolicy|UserPolicy|Process|CurrentUser|LocalMachine)\s+\S+/.test(x))
    .map((x) => x.replace(/\s+/g, "="));
  return redovi.length > 0 ? `politika: ${redovi.join(" ")}` : "efektivna politika nije prepoznata";
}

/** Identifikator, kategorija i red PowerShell greške — bez poruke i putanje. */
function powershellSazetak(tekst) {
  const id = /FullyQualifiedErrorId\s*:\s*([A-Za-z0-9_.,-]+)/.exec(tekst)?.[1];
  const kategorija = /CategoryInfo\s*:\s*([A-Za-z]+)/.exec(tekst)?.[1];
  const mesto = /[\\/]([A-Za-z0-9_-]+\.ps1):(\d+)\s+char:(\d+)/.exec(tekst);
  const delovi = [
    id && `id=${id}`,
    kategorija && `kategorija=${kategorija}`,
    mesto && `mesto=${mesto[1]}:${mesto[2]}:${mesto[3]}`,
  ].filter(Boolean);
  return delovi.length > 0 ? delovi.join(" ") : "bez PowerShell identifikatora greške";
}

function powershell(args, timeout = 120000) {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args],
    { encoding: "utf8", timeout },
  );
  return { kod: r.status, signal: r.signal ?? null, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/* =========================================================================
 * Odbijanje van Windows-a
 * ====================================================================== */

if (platform() !== "win32") {
  console.error(
    `Ovaj runner radi ISKLJUČIVO na Windows-u; tekuća platforma je ${platform()}.\n` +
      "Windows provere se NE mogu simulirati i NE smeju se prikazati kao prošle.\n" +
      "Na macOS-u/Linuxu koristi `node --test connector/test/*.test.mjs` — tamo su\n" +
      "[WIN] testovi izričito preskočeni.\n",
  );
  process.exit(2);
}

/* =========================================================================
 * Priprema
 * ====================================================================== */

console.log("Carsystem — Windows smoke");
console.log(`Izvorni HEAD: ${META.sourceHead}`);
console.log(`Radni folder: %TEMP%\\Carsystem Smoke ČĆŽŠĐ`);
console.log("");

rmSync(SMOKE, { recursive: true, force: true });
mkdirSync(STANJE, { recursive: true });
mkdirSync(ULAZ, { recursive: true });
mkdirSync(PRAZAN, { recursive: true });

/*
 * Ulazni folder dobija SAMO sintetičke fixture iz paketa.
 *
 * Nijedan postojeći folder na mašini se ne čita — ni Downloads, ni Documents,
 * ni BizniSoft izlaz. To je jedina garancija da prvi prolaz ne dodirne pravu
 * poslovnu prepisku.
 */
copyFileSync(join(FIXTURES, "vise-stavki.pdf"), join(ULAZ, "Faktura ČĆŽ 001.pdf"));
copyFileSync(join(FIXTURES, "jedna-stavka.pdf"), join(ULAZ, "FAK-ČĆŽ-002.pdf"));
/*
 * Treći PDF namerno NEMA oznaku fakture. Sadržaj je ispravan, pa bi bez
 * filtera po imenu ušao u red; `W09` dokazuje da na Windowsu ostaje po strani.
 */
copyFileSync(join(FIXTURES, "vise-stavki.pdf"), join(ULAZ, "Račun ČĆŽ 003.pdf"));

/*
 * `smoke.invalid` je rezervisan TLD koji se ne razrešava.
 *
 * Nijedna provera ne šalje zahtev, ali i da neka pokuša, ne postoji host do
 * koga bi stigla. Pravi origin se u prvom prolazu ne upisuje.
 */
writeFileSync(
  KONFIG,
  JSON.stringify(
    {
      serverOrigin: "https://smoke.invalid",
      deviceCode: "smoke-uredjaj",
      keyId: "k1",
      sourceSystem: "biznisoft",
      issuerCode: "SMOKE",
      izvorniFolder: ULAZ,
    },
    null,
    2,
  ),
);

/* =========================================================================
 * Provere
 * ====================================================================== */

/*
 * Uvoz se pokušava JEDNOM, pre provera.
 *
 * Isti test koji radi entrypoint. Rezultat se koristi i u `W02` i u
 * dijagnostici, pa se ne ponavlja.
 */
let sqliteDostupan = false;
try {
  await import("node:sqlite");
  sqliteDostupan = true;
} catch {
  sqliteDostupan = false;
}

const okolina = {
  os: osVersion(),
  build: release(),
  arch: arch(),
  node: process.versions.node,
};

provera("W01", "Windows izdanje i arhitektura", () => {
  if (okolina.arch !== "x64" && okolina.arch !== "arm64") pad("unsupported_arch");
  return { detalj: `${okolina.os} build ${okolina.build} ${okolina.arch}` };
});

provera("W02", "Node zadovoljava runtime ugovor konektora", () => {
  /*
   * Ugovor je `major >= 22` + stvarno dostupan `node:sqlite`, tačno onako kako
   * ga sprovodi `bin/connector.mjs`. Zaključavanje na `24.14.x` je prvi prolaz
   * oborilo na Node 24.20.0 — runtime-u koji ugovor podržava.
   *
   * `node:sqlite` se PROVERAVA uvozom, ne izvodi iz broja verzije: postoje
   * build-ovi koji znaju za ime modula a `import` im puca.
   */
  const o = oceniRuntime({
    verzija: process.versions.node,
    testirani: testiraniMajor(META.requiredNode),
    sqliteDostupan: sqliteDostupan,
  });
  if (o.status === "fail") pad(o.kod, o.detalj);
  if (o.status === "skip") return { skip: true, kod: o.kod, detalj: o.detalj };
  return { detalj: o.detalj };
});

provera("W03", "paket raspakovan u putanju sa razmakom i ČĆŽŠĐ", () => {
  const imaRazmak = / /.test(PAKET);
  const imaSrpska = /[ČĆŽŠĐčćžšđ]/.test(PAKET);
  if (!imaRazmak || !imaSrpska) pad("package_path_not_exercised");
  return { detalj: "putanja paketa nosi razmak i srpska slova" };
});

provera("W04", "spakovan connector.cmd se pokreće", () => {
  const r = konektor(["--help"]);
  if (r.kod !== 0) pad("cmd_launch_failed");
  if (!/Carsystem konektor/.test(r.stdout)) pad("cmd_unexpected_output");
  for (const k of ["doctor", "init", "poll-once", "watch", "status"]) {
    if (!r.stdout.includes(k)) pad("cmd_missing_command");
  }
  return { detalj: "pokretač radi, sve očekivane komande prisutne" };
});

provera("W05", "doctor u izolovanoj konfiguraciji", () => {
  const r = konektor(["doctor"]);
  const d = json(r.stdout);
  if (!d) pad("doctor_no_json", `izlaz nije JSON (kod ${r.kod})`);

  /*
   * Dva RAZLIČITA kvara su ranije delila jednu šifru.
   *
   * `doctor_reported_problem` je pokrivao i „proces je pao" i „provera je našla
   * problem", pa se iz izveštaja nije videlo koje od to dvoje se desilo. Sada
   * su odvojeni, a detalj imenuje KOJE provere su pale — imena provera su naša,
   * ne podaci sa mašine.
   */
  const problematicne = (d.nalazi ?? [])
    .filter((n) => n.status === "greska")
    .map((n) => `${n.provera}${n.detalj?.kod ? `(${n.detalj.kod})` : ""}`);

  if (problematicne.length > 0) {
    pad("doctor_reported_problem", `pale provere: ${problematicne.join(", ")}`);
  }
  if (r.kod !== 0) pad("doctor_exit_nonzero", `doctor nije prijavio problem, a izašao je sa ${r.kod}`);

  const skladiste = d.nalazi.find((n) => n.provera === "skladiste_kljuca");
  if (!skladiste) pad("doctor_no_keystore_finding", "doctor ne prijavljuje skladište ključa");
  /*
   * Na Windowsu adapter MORA biti DPAPI.
   *
   * Da je izabran bilo koji drugi, ključ ne bi bio vezan za nalog — i ceo
   * bezbednosni model prvog prolaza bi bio prazan.
   */
  if (!/dpapi/i.test(JSON.stringify(skladiste))) {
    pad("keystore_not_dpapi", `adapter prijavljen kao: ${skladiste.detalj?.adapter ?? "nepoznat"}`);
  }

  const protokol = d.nalazi.find((n) => n.provera === "protokol_komandi");
  if (!protokol || protokol.status !== "ok") {
    pad("command_protocol_incompatible", `status=${protokol?.status ?? "nema nalaza"}`);
  }
  if ((protokol.detalj.nepotpisanePutanje ?? []).length !== 0) {
    pad("unsigned_command_path", `nepotpisanih putanja: ${protokol.detalj.nepotpisanePutanje.length}`);
  }

  return {
    detalj:
      `adapter=DPAPI, protokol tip=${protokol.detalj.tip} v${protokol.detalj.verzija}, ` +
      `šema reda=${protokol.detalj.semaReda}`,
  };
});

let otisakPrvi = null;

provera("W06", "init pravi ključ kroz DPAPI, bez tajne na ekranu", () => {
  const r = konektor(["init"]);
  const d = json(r.stdout);
  /*
   * Konektor sam prijavljuje šifru greške (`{status:"greska", kod:…}`), i ta
   * šifra je već redigovana na njegovoj strani. Prenosi se doslovno: bez nje se
   * `init_failed` ne razlikuje od bilo kog drugog neuspeha.
   */
  if (!d) pad("init_failed", `izlaz nije JSON (kod ${r.kod})`);
  if (d.status !== "napravljen") {
    pad("init_failed", `status=${d.status ?? "?"} kod=${d.kod ?? "?"} izlaz=${r.kod}`);
  }
  if (r.kod !== 0) pad("init_wrong_exit", `ključ prijavljen kao napravljen, a izlaz je ${r.kod}`);
  if (!/dpapi/i.test(String(d.adapter))) pad("init_not_dpapi", `adapter=${d.adapter ?? "?"}`);
  if (!d.javniKljucSpkiBase64 || !d.fingerprint) {
    pad("init_no_public_material", "nedostaje javni ključ ili otisak");
  }

  /*
   * Fajl ključa NE SME biti čitljiv PKCS8.
   *
   * DPAPI izlaz je šifrovan; ako bi se ovde uspešno učitao privatni ključ,
   * značilo bi da negde postoji plaintext fallback.
   */
  const bajtovi = readFileSync(join(STANJE, "device-key.bin"));
  if (bajtovi.length === 0) pad("key_file_empty");
  if (/BEGIN [A-Z ]*PRIVATE KEY/.test(bajtovi.toString("utf8"))) pad("key_file_plaintext");

  otisakPrvi = d.fingerprint;
  return { detalj: "ključ napravljen i zaštićen DPAPI-jem" };
});

provera("W07", "ponovljen init NE menja ključ", () => {
  /*
   * Bez ključa iz `W06` ovo NIJE zaseban kvar nego posledica.
   *
   * Prijaviti ga kao FAIL značilo bi da jedan uzrok proizvede dva pada i da
   * izveštaj tvrdi dva problema tamo gde postoji jedan. `W07` je ključna
   * provera, pa SKIP i dalje daje INCOMPLETE — nikad tihi PASS.
   */
  if (!otisakPrvi) {
    return {
      skip: true,
      kod: "prerequisite_missing",
      detalj: "W06 nije napravio ključ; ovo je posledica, ne zaseban kvar",
    };
  }
  const r = konektor(["init"]);
  const d = json(r.stdout);
  if (!d || d.status !== "vec_postoji") {
    pad("init_replaced_key", `status=${d?.status ?? "nema JSON-a"}`);
  }
  if (r.kod !== 1) pad("init_repeat_wrong_exit", `očekivan izlaz 1, dobijen ${r.kod}`);

  const e = json(konektor(["export-key"]).stdout);
  if (!e || !e.fingerprint) pad("export_key_failed", `kod=${e?.kod ?? "nema JSON-a"}`);
  if (e.fingerprint !== otisakPrvi) {
    // Vrednosti se NE prijavljuju; dovoljna je tvrdnja da su se razišle.
    pad("fingerprint_changed", "otisak se promenio između dva poziva");
  }
  /*
   * Otisak se NE upisuje u rezultat.
   *
   * Izvodi se iz javnog ključa i vezuje ovaj računar za konkretan uređaj; za
   * dokaz je dovoljno da je između dva poziva ISTI.
   */
  return { detalj: "otisak nepromenjen između dva poziva (vrednost se ne prijavljuje)" };
});

provera("W08", "privatni ključ ne prolazi kroz stdout ni stderr", () => {
  const izlazi = [
    konektor(["doctor"]),
    konektor(["export-key"]),
    konektor(["status"]),
  ];
  for (const r of izlazi) {
    if (!nemaTajni(r.stdout)) pad("secret_in_stdout");
    if (!nemaTajni(r.stderr)) pad("secret_in_stderr");
  }
  // I log na disku mora biti čist.
  const logDir = join(STANJE, "logs");
  if (existsSync(logDir)) {
    for (const f of readdirSync(logDir)) {
      if (!nemaTajni(readFileSync(join(logDir, f), "utf8"))) pad("secret_in_log");
    }
  }
  return { detalj: "nijedan izlaz ne nosi dugačak base64 ni PEM blok" };
});

provera("W09", "dry-run čita SAMO sintetički folder i ništa ne šalje", () => {
  const r = konektor(["dry-run"]);
  const d = json(r.stdout);
  if (!d || r.kod !== 0) pad("dry_run_failed");
  if (d.poslato !== 0) pad("dry_run_sent_data");
  if ((d.novo ?? 0) < 2) pad("dry_run_missed_documents");
  if (d.nijeFakturaPoNazivu !== 1) {
    pad("dry_run_name_filter", `nijeFakturaPoNazivu=${d.nijeFakturaPoNazivu ?? "?"}, očekivano 1`);
  }
  if (d.kandidata !== 2) pad("dry_run_name_filter", `kandidata=${d.kandidata ?? "?"}, očekivano 2`);
  return {
    detalj: `ukupnoPdf=${d.ukupnoPdf ?? "?"} kandidata=${d.kandidata} nijeFakturaPoNazivu=${d.nijeFakturaPoNazivu} novo=${d.novo} poslato=0`,
  };
});

provera("W10", "red preživljava nov proces (node:sqlite, WAL)", () => {
  /*
   * Drugi proces, isti fajl.
   *
   * Ovo je jedina provera koja stvarno dokazuje da `node:sqlite` na Windows
   * fajl sistemu commit-uje na disk, a ne samo u memoriju procesa.
   */
  const r = konektor(["status"]);
  const d = json(r.stdout);
  if (!d || r.kod !== 0) pad("status_failed");
  const ukupno = Object.values(d.red ?? {}).reduce((a, b) => a + b, 0);
  if (ukupno < 2) pad("queue_not_persisted");
  if (!existsSync(join(STANJE, "queue.db"))) pad("queue_file_missing");
  return { detalj: `red posle restarta ima ${ukupno} stavke` };
});

provera("W11", "poll-once bez konfiguracije daje jasnu grešku", () => {
  const r = konektor(["poll-once"], {
    env: okruzenje({ CS_CONNECTOR_CONFIG: join(PRAZAN, "nema.json") }),
    timeout: 60000,
  });
  if (r.istekao) pad("poll_once_hung");
  const d = json(r.stdout) ?? json(r.stderr);
  if (!d || d.status !== "greska") pad("poll_once_no_clean_error");
  if (/\n\s+at /.test(r.stdout + r.stderr)) pad("stack_trace_leaked");
  return { detalj: `kod=${d.kod ?? "?"}, bez stack trace-a` };
});

provera("W12", "watch bez konfiguracije STAJE, bez tight loop-a", () => {
  /*
   * Petlja mora da stane sama.
   *
   * Timeout je ovde detektor kvara, ne strpljenje: da `watch` greške
   * podešavanja tretira kao mrežne, ovde bi visio do isteka i to je FAIL.
   */
  const r = konektor(["watch"], {
    env: okruzenje({ CS_CONNECTOR_CONFIG: join(PRAZAN, "nema.json") }),
    timeout: 90000,
  });
  if (r.istekao) pad("watch_tight_loop_or_hang", "petlja nije stala u 90 s");

  /*
   * Ugovor, ne slučajna vrednost.
   *
   * `src/cli.mjs` vraća 1 kada `pollOnce` baci grešku iz skupa `NEPOPRAVLJIVO`
   * (`config_missing` je u njemu), i tada ispisuje `status: "zaustavljeno"`.
   * Traži se OBOJE: sam izlazni kod ne razlikuje uredno zaustavljanje od
   * neuhvaćene greške, koju `main()` takođe prijavljuje kodom 1.
   *
   * Do popravke pokretača ovde je stizala nula: `connector.cmd` je završavao
   * sa `endlocal` i gutao kod. Zato se sada meri i prijavljuje DOBIJENA
   * vrednost, da sledeći pad ne bude ponovo bez traga.
   */
  const d = json(r.stdout);
  if (!d) pad("watch_no_json", `izlaz nije JSON (kod ${r.kod})`);
  if (d.status !== "zaustavljeno") {
    pad("watch_did_not_report_stop", `status=${d.status ?? "?"} kod=${d.kod ?? "?"}`);
  }
  if (r.kod !== 1) {
    pad(
      "watch_wrong_exit",
      `petlja je prijavila zaustavljanje (${d.kod ?? "?"}), ` +
        `ali je pokretač vratio ${r.kod} umesto 1`,
    );
  }
  return { detalj: `staje sa izlazom 1, kod=${d.kod ?? "?"}` };
});


/**
 * Jedini poziv `task.ps1` u smoke toku — namerno u imenovanoj, uskoj
 * konstanti, ne inline, da bi regresioni test mogao da pregleda TAČNO ovaj
 * niz argumenata, a ne ceo tekst fajla.
 *
 * `-Mode Smoke` je OBAVEZAN otkad `task.ps1` to zahteva za `-Action install`
 * (WIN-INSTALL-01 korekcija) — bez njega skripta baca grešku PRE ijedne
 * provere, umesto `[dry-run]` izlaza koji W13 očekuje. NIKAD `-Apply`, NIKAD
 * `-Mode Production`, NIKAD realan BizniSoft folder — samo `DIST`, spakovan
 * sintetički izlaz `connector:build`-a iz ovog istog paketa.
 */
const W13_TASK_ARGS = ["-File", join(WINDOWS, "task.ps1"), "-Action", "install", "-Mode", "Smoke", "-PackagePath", DIST];

provera("W13", "task.ps1 ostaje dry-run i NE pravi zadatak", () => {
  const pocetak = new Date();
  const r = powershell(W13_TASK_ARGS);
  const kraj = new Date();

  /*
   * Ocena: izlaz MORA biti 0 i izlaz MORA nositi `[dry-run]` koji piše sama
   * skripta. Detalj nosi vreme (HH:mm:ss) i izlazni kod, da se prijava
   * antivirusa može povezati sa ovim pozivom (kancelarija d5e03d1: Avast
   * PSD11 na task.ps1 uz SMOKE PASS, bez vremena u izveštaju).
   *
   * Execution policy je STANJE MAŠINE, ne kvar paketa: kada je politiku
   * postavila Group Policy, `-ExecutionPolicy Bypass` se IGNORIŠE. To je
   * kontrolisan SKIP sa imenovanim uzrokom, ne razlog za menjanje politike.
   */
  const o = oceniPozivSkripte({
    kod: r.kod, signal: r.signal, stdout: r.stdout, stderr: r.stderr,
    ocekivanKod: 0, oznaka: /\[dry-run\]/, pocetak, kraj,
  });

  /*
   * Zadatak se proverava uvek, kroz `schtasks.exe` — NE `Get-ScheduledTask`:
   * na kancelarijskom računaru CIM vraća 0x80070002, a uz SilentlyContinue
   * to je „ne postoji" i kada postoji.
   */
  const z = zadatakPremaSchtasks(spawnSync, "\\Carsystem\\CarsystemConnector");
  if (z.greska) pad("schtasks_unavailable", `schtasks.exe se nije pokrenuo (${z.greska}); ${o.detalj}`);
  if (z.postoji) {
    pad("scheduled_task_created", `zadatak CarsystemConnector postoji posle dry-run-a; ${o.detalj}`);
  }

  if (o.ishod === "politika") {
    return {
      skip: true,
      kod: o.kod,
      detalj: `politika izvršavanja blokira .ps1 (${o.detalj}); ${politikaOpis()}. ` +
        "Zadatak NIJE registrovan. Ne menjati politiku zbog smoke-a.",
    };
  }
  if (o.ishod !== "ok") {
    /*
     * Detalj nosi vreme, izlazni kod i PowerShell identifikator — ne poruku,
     * koja može da sadrži putanju sa imenom naloga.
     */
    pad(o.kod, `${o.detalj}; ${powershellSazetak(`${r.stdout}${r.stderr}`)}; ${politikaOpis()}`);
  }
  return { detalj: `plan ispisan, zadatak NIJE registrovan (schtasks izlaz ${z.kod}); ${o.detalj}` };
});

provera("W14", "spakovan konektor ne bira test skladište ključa", () => {
  /*
   * Na Windowsu je DPAPI dostupan, pa se test adapter ionako ne bira.
   * Ovo potvrđuje da ni IZRIČITA promenljiva ne menja izbor u paketu — što je
   * ono što bi napadač ili greška u skripti pokušali.
   */
  const r = konektor(["doctor"], { env: okruzenje({ CS_CONNECTOR_INSECURE_KEYSTORE: "1" }) });
  const d = json(r.stdout);

  /*
   * Ono što se OVDE meri je IZBOR adaptera, ne njegova ispravnost.
   *
   * Ranije je ista šifra (`keystore_not_dpapi_under_flag`) pokrivala i „izabran
   * je pogrešan adapter" i „DPAPI je izabran ali je pukao": kada `proveri()`
   * baci, doctor u nalaz upiše samo šifru greške i ime adaptera nestane, pa
   * traženje reči „dpapi" u izlazu ne uspe. Prvi prolaz je tako prijavio izbor
   * nebezbednog skladišta tamo gde ga nije bilo.
   *
   * Jedina tvrdnja koja ovde sme da padne je da je izabrano test skladište.
   */
  if (/test-insecure/.test(r.stdout)) {
    pad("insecure_keystore_selected", "izričita promenljiva je izabrala test skladište");
  }

  const skladiste = d?.nalazi?.find((n) => n.provera === "skladiste_kljuca");
  if (skladiste?.status === "greska") {
    return {
      skip: true,
      kod: "keystore_error_under_flag",
      detalj:
        `DPAPI nije izabrao test skladište, ali je i sam prijavio grešku ` +
        `(${skladiste.detalj?.kod ?? "?"}); vidi W05/W06 i \`RUN-SMOKE.cmd diagnose\``,
    };
  }
  if (!/dpapi/i.test(r.stdout)) {
    pad("keystore_not_dpapi_under_flag", `adapter=${skladiste?.detalj?.adapter ?? "nepoznat"}`);
  }
  if (r.kod !== 0) pad("doctor_failed_under_insecure_flag", `doctor je izašao sa ${r.kod}`);
  return { detalj: "izričit CS_CONNECTOR_INSECURE_KEYSTORE=1 ne menja adapter" };
});

/* --- Postojeći automatizovani testovi iz paketa. ------------------------ */

let winRezime = null;

provera("W15", "postojeći connector testovi (uključujući [WIN])", () => {
  const r = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap",
     join(TESTOVI, "pure.test.mjs"),
     join(TESTOVI, "scanner-store.test.mjs"),
     join(TESTOVI, "commands.test.mjs"),
     join(TESTOVI, "windows-smoke.test.mjs")],
    { encoding: "utf8", timeout: 600000, cwd: PAKET },
  );
  const izlaz = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  writeFileSync(join(SMOKE, "testovi-tap.log"), izlaz);

  const broj = (kljuc) => Number((izlaz.match(new RegExp(`^# ${kljuc} (\\d+)`, "m")) ?? [])[1] ?? -1);
  const pass = broj("pass");
  const fail = broj("fail");
  const skip = broj("skipped");
  if (pass < 0) pad("test_output_unparseable", `izlaz nema TAP zbir (izlazni kod ${r.status})`);

  const preskoceniWin = (izlaz.match(/^ok \d+ - \[WIN\][^\n]*# SKIP/gm) ?? []).length;
  const ukupnoWin = (izlaz.match(/^(?:not )?ok \d+ - \[WIN\]/gm) ?? []).length;
  const paliTestovi = [...izlaz.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
  const paliWin = paliTestovi.filter((x) => x.startsWith("[WIN]"));

  /*
   * Zbir se upisuje PRE nego što provera može da padne.
   *
   * Ranije je `winRezime` dodeljivan tek posle `pad("existing_tests_failed")`,
   * pa je svaki pad u `W15` ostavljao `W15-win` bez ijednog podatka — i ta
   * provera je onda prijavljivala `win_summary_missing`, kao da [WIN] skup nije
   * ni pokrenut. Jedan uzrok je proizvodio dva pada, od kojih je drugi
   * pogrešno opisivao stanje.
   */
  winRezime = { pass, fail, skip, preskoceniWin, ukupnoWin, paliWin, paliTestovi };

  if (fail > 0) {
    /*
     * Imena testova su NAŠA, ne podaci sa mašine — smeju u izveštaj i jedina su
     * stvar iz koje se pad može dijagnostikovati bez lokalnog TAP loga.
     */
    const prvi = paliTestovi.slice(0, 3).join(" · ");
    pad(
      paliWin.length > 0 ? "win_tests_failed" : "existing_tests_failed",
      `palo ${fail} (od toga [WIN] ${paliWin.length}): ${prvi}${paliTestovi.length > 3 ? " …" : ""}`,
    );
  }

  // Preskoke procenjuje `W15-win`: preskok nije pad, ali nije ni prolaz.
  return {
    detalj: `pass=${pass} fail=${fail} skipped=${skip} ` +
      `([WIN] ${ukupnoWin - preskoceniWin}/${ukupnoWin} izvršeno)`,
  };
});

provera("W15-win", "[WIN] suite je stvarno izvršen na ovoj mašini", () => {
  /*
   * Bez zbira se NE tvrdi ni da jeste ni da nije izvršen.
   *
   * `W15` sada upisuje zbir pre nego što može da padne, pa je ovo stanje
   * moguće samo ako je `W15` pukao pre parsiranja TAP izlaza — dakle testovi se
   * uopšte nisu pokrenuli. Razlog mora to i reći.
   */
  if (!winRezime) {
    pad("win_summary_missing", "W15 nije stigao da pročita TAP zbir; skup verovatno nije ni pokrenut");
  }
  const { ukupnoWin, preskoceniWin, paliWin } = winRezime;
  if (ukupnoWin === 0) {
    pad("win_suite_absent", "TAP izlaz ne sadrži nijedan [WIN] test");
  }
  const izvrseno = ukupnoWin - preskoceniWin;
  if (paliWin.length > 0) {
    pad("win_tests_failed", `palo ${paliWin.length} [WIN] testova: ${paliWin.slice(0, 3).join(" · ")}`);
  }
  /*
   * NIJEDAN [WIN] test ne sme biti preskočen.
   *
   * Svaki [WIN] test u paketu je automatski izvršiv; ručne provere su izvan
   * skupa (`RUCNE_PROVERE`). Preskok ovde znači da nešto što je trebalo da se
   * izmeri na ovoj mašini nije izmereno — INCOMPLETE, ne PASS.
   */
  if (preskoceniWin > 0) {
    return {
      skip: true,
      kod: "win_tests_skipped",
      detalj: `izvršeno ${izvrseno}/${ukupnoWin}; preskočen ${preskoceniWin} automatski [WIN] test`,
    };
  }
  // Broj se RAČUNA, ne kuca: [WIN] skup je dopunjiv.
  return { detalj: `svih ${ukupnoWin} automatskih [WIN] testova izvršeno` };
});

/* =========================================================================
 * Rezultat
 * ====================================================================== */

const brojStatusa = (s) => nalazi.filter((n) => n.status === s).length;
const kljucniSkip = nalazi.some((n) => KLJUCNE.has(n.id) && n.status === "SKIP");
const kljucniFail = nalazi.some((n) => KLJUCNE.has(n.id) && n.status === "FAIL");

let ishod;
if (brojStatusa("FAIL") > 0 || kljucniFail) ishod = "SMOKE FAIL";
else if (kljucniSkip || brojStatusa("SKIP") > 0) ishod = "SMOKE INCOMPLETE";
else ishod = "SMOKE PASS";

const REZULTAT = join(SMOKE, `windows-smoke-result-${META.shortHead}.md`);
const REZULTAT_JSON = join(SMOKE, `windows-smoke-result-${META.shortHead}.json`);

const dpapiIzvrsen = nalazi.find((n) => n.id === "W06")?.status === "PASS";
const redPonovoOtvoren = nalazi.find((n) => n.id === "W10")?.status === "PASS";
const unicodePutanja = nalazi.find((n) => n.id === "W03")?.status === "PASS";

const red = (n) =>
  `| ${n.id} | ${n.naziv} | ${n.status} | ${redigovan(n.detalj) || "—"} | ${n.kod ?? "—"} |`;

/*
 * PRIMARNO nasuprot POSLEDICI.
 *
 * Prvi prolaz je vratio devet padova, a stvarnih uzroka je bilo dva. Spisak od
 * devet ravnopravnih redova navodi na devet nezavisnih popravki — i tako se
 * troši dan na posledice.
 *
 * Veze su ZNANE, ne pogađane: `W07` traži ključ iz `W06`, `W14` čita isti
 * nalaz doctora kao `W05`, a `W15-win` čita zbir iz `W15`.
 */
const ZAVISI_OD = { W06: ["W05"], W07: ["W06"], W14: ["W05", "W06"], "W15-win": ["W15"] };
const stanje = (id) => nalazi.find((n) => n.id === id)?.status;
const problem = (id) => stanje(id) === "FAIL" || stanje(id) === "SKIP";

const neuredni = nalazi.filter((n) => n.status === "FAIL" || n.status === "SKIP");
const primarni = neuredni.filter((n) => !(ZAVISI_OD[n.id] ?? []).some(problem));
const posledice = neuredni.filter((n) => (ZAVISI_OD[n.id] ?? []).some(problem));

const klasifikacija = neuredni.length === 0
  ? ["Nijedna provera nije pala ni preskočena."]
  : [
      "Provere se ne broje ravnopravno: neke padaju zato što je pala druga.",
      "",
      "**Primarni nalazi — ovde počinje dijagnoza:**",
      "",
      ...primarni.map((n) => `- \`${n.id}\` (${n.status}) \`${n.kod ?? "—"}\` — ${redigovan(n.detalj) || "bez detalja"}`),
      "",
      posledice.length > 0 ? "**Posledice — očekuje se da nestanu kad primarni budu rešeni:**" : "",
      posledice.length > 0 ? "" : "",
      ...posledice.map(
        (n) => `- \`${n.id}\` (${n.status}) — zavisi od ${(ZAVISI_OD[n.id] ?? []).map((x) => `\`${x}\``).join(", ")}`,
      ),
    ].filter((x) => x !== "" || true);

writeFileSync(
  REZULTAT,
  [
    `# Windows smoke — rezultat (${META.shortHead})`,
    "",
    `**Ishod: ${ishod}**`,
    "",
    "## Okruženje",
    "",
    "| | |",
    "|---|---|",
    `| Windows | ${okolina.os} (build ${okolina.build}) |`,
    `| Arhitektura | ${okolina.arch} |`,
    `| Node | ${okolina.node} |`,
    `| Izvorni HEAD | ${META.sourceHead} |`,
    `| Verzija konektora | ${META.connectorVersion} |`,
    `| Verzija protokola potpisa | ${META.protocolVersion} |`,
    `| Šema lokalnog reda | ${META.storeSchema} |`,
    `| Tip komande | ${META.commandType} v${META.commandVersion} |`,
    "",
    "## Ključne tvrdnje",
    "",
    `- DPAPI stvarno izvršen: **${dpapiIzvrsen ? "DA" : "NE"}**`,
    `- Red ponovo otvoren u novom procesu: **${redPonovoOtvoren ? "DA" : "NE"}**`,
    `- Testovi radili iz putanje sa razmakom i ČĆŽŠĐ: **${unicodePutanja ? "DA" : "NE"}**`,
    "- Scheduled Task napravljen: **NE**",
    "- Stvarni server pozvan: **NE**",
    "- Korišćeni pravi PDF-ovi: **NE** (samo sintetički fixtures iz paketa)",
    "- Feature gate uključen: **NE**",
    "",
    "## Provere",
    "",
    "| ID | Provera | Status | Detalj | Kod |",
    "|---|---|---|---|---|",
    ...nalazi.map(red),
    "",
    `Zbir: PASS ${brojStatusa("PASS")} · FAIL ${brojStatusa("FAIL")} · SKIP ${brojStatusa("SKIP")}`,
    "",
    "## Ručne provere — NISU izvršene",
    "",
    "Nisu deo automatskog prolaza i ne ulaze u ishod iznad. `SMOKE PASS` **ne**",
    "znači da su urađene; svaka se radi posebno, po dogovoru.",
    "",
    "| ID | Provera | Status | Postupak |",
    "|---|---|---|---|",
    ...RUCNE_PROVERE.map((m) => `| ${m.id} | ${m.naziv} | ${RUCNO_NIJE_IZVRSENO} | ${m.postupak} |`),
    "",
    "## Šta je primarno, a šta posledica",
    "",
    ...klasifikacija,
    "",
    ...(neuredni.length > 0
      ? [
          "Ako je među primarnim nalazima nešto oko DPAPI-ja ili PowerShell-a,",
          "pokreni i:",
          "",
          "```",
          "smoke\\RUN-SMOKE.cmd diagnose",
          "```",
          "",
          "Taj alat proizvodi zaseban redigovan izveštaj o PowerShell okruženju",
          "(dostupnost, jezički režim, politika izvršavanja, DPAPI proba) i ne",
          "menja ništa na računaru.",
          "",
        ]
      : []),
    "## Napomena o redakciji",
    "",
    "Ovaj fajl je namenjen slanju. Ne sadrži korisničko ime, ime računara,",
    "apsolutne putanje, ključeve, potpise, PIB, nazive kupaca ni stack trace.",
    "Detaljan TAP log ostaje LOKALNO (`testovi-tap.log`) i ne šalje se dok se",
    "posebno ne pregleda.",
    "",
  ].join("\n"),
);

writeFileSync(
  REZULTAT_JSON,
  `${JSON.stringify(
    {
      ishod,
      sourceHead: META.sourceHead,
      connectorVersion: META.connectorVersion,
      protocolVersion: META.protocolVersion,
      storeSchema: META.storeSchema,
      commandType: META.commandType,
      commandVersion: META.commandVersion,
      windows: { izdanje: okolina.os, build: okolina.build, arch: okolina.arch },
      node: okolina.node,
      dpapiIzvrsen,
      redPonovoOtvoren,
      unicodePutanja,
      scheduledTaskNapravljen: false,
      serverPozvan: false,
      praviPdfovi: false,
      featureGateUkljucen: false,
      provere: nalazi.map((n) => ({ id: n.id, status: n.status, kod: n.kod })),
      rucneProvere: RUCNE_PROVERE.map((m) => ({ id: m.id, status: RUCNO_NIJE_IZVRSENO })),
    },
    null,
    2,
  )}\n`,
);

console.log("");
console.log(`Rezultat (redigovan): %TEMP%\\Carsystem Smoke ČĆŽŠĐ\\windows-smoke-result-${META.shortHead}.md`);
console.log(`JSON:                 %TEMP%\\Carsystem Smoke ČĆŽŠĐ\\windows-smoke-result-${META.shortHead}.json`);
console.log(`Detaljan lokalni log: %TEMP%\\Carsystem Smoke ČĆŽŠĐ\\testovi-tap.log  (NE šalji bez pregleda)`);
console.log("");
console.log("Ključ i lokalni red NISU obrisani — ostaju za proveru.");
console.log("Brisanje je zasebna odluka:  RUN-SMOKE.cmd cleanup");
console.log("");
for (const m of RUCNE_PROVERE) console.log(`${RUCNO_NIJE_IZVRSENO}  ${m.id}  ${m.naziv}`);
console.log("");
console.log(ishod);

process.exitCode = ishod === "SMOKE PASS" ? 0 : ishod === "SMOKE INCOMPLETE" ? 4 : 1;
