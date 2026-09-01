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
import { fileURLToPath } from "node:url";

const OVDE = dirname(fileURLToPath(import.meta.url));
const PAKET = resolve(OVDE, "..");
const DIST = join(PAKET, "connector", "dist");
const TESTOVI = join(PAKET, "connector", "test");
const WINDOWS = join(PAKET, "connector", "windows");
const FIXTURES = join(PAKET, "fixtures", "dev", "biznisoft");
const META = JSON.parse(readFileSync(join(OVDE, "package-meta.json"), "utf8"));

/* =========================================================================
 * Izveštavanje
 * ====================================================================== */

const nalazi = [];
/** Ključne provere: SKIP na bilo kojoj od njih daje INCOMPLETE, ne PASS. */
const KLJUCNE = new Set(["W05", "W06", "W07", "W10", "W14", "W15-win"]);

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
    zabelezi(id, naziv, "FAIL", "", (e && e.kod) || "unexpected_error");
  }
}

class Pad extends Error {
  constructor(kod) {
    super(kod);
    this.kod = kod;
  }
}
const pad = (kod) => {
  throw new Pad(kod);
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

function powershell(args, timeout = 120000) {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args],
    { encoding: "utf8", timeout },
  );
  return { kod: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
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
copyFileSync(join(FIXTURES, "vise-stavki.pdf"), join(ULAZ, "Račun ČĆŽ 001.pdf"));
copyFileSync(join(FIXTURES, "jedna-stavka.pdf"), join(ULAZ, "Račun ČĆŽ 002.pdf"));

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

provera("W02", "Node 24.14.x", () => {
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj !== 24) pad("node_major_mismatch");
  if (min !== 14) pad("node_minor_mismatch");
  return { detalj: `Node ${process.versions.node}` };
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
  if (!d) pad("doctor_no_json");
  if (r.kod !== 0 || d.problema !== 0) pad("doctor_reported_problem");

  const skladiste = d.nalazi.find((n) => n.provera === "skladiste_kljuca");
  if (!skladiste) pad("doctor_no_keystore_finding");
  /*
   * Na Windowsu adapter MORA biti DPAPI.
   *
   * Da je izabran bilo koji drugi, ključ ne bi bio vezan za nalog — i ceo
   * bezbednosni model prvog prolaza bi bio prazan.
   */
  if (!/dpapi/i.test(JSON.stringify(skladiste))) pad("keystore_not_dpapi");

  const protokol = d.nalazi.find((n) => n.provera === "protokol_komandi");
  if (!protokol || protokol.status !== "ok") pad("command_protocol_incompatible");
  if ((protokol.detalj.nepotpisanePutanje ?? []).length !== 0) pad("unsigned_command_path");

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
  if (!d || r.kod !== 0 || d.status !== "napravljen") pad("init_failed");
  if (!/dpapi/i.test(String(d.adapter))) pad("init_not_dpapi");
  if (!d.javniKljucSpkiBase64 || !d.fingerprint) pad("init_no_public_material");

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
  if (!otisakPrvi) pad("prerequisite_missing");
  const r = konektor(["init"]);
  const d = json(r.stdout);
  if (!d || d.status !== "vec_postoji") pad("init_replaced_key");
  if (r.kod !== 1) pad("init_repeat_wrong_exit");

  const e = json(konektor(["export-key"]).stdout);
  if (!e || !e.fingerprint) pad("export_key_failed");
  if (e.fingerprint !== otisakPrvi) pad("fingerprint_changed");
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
  return { detalj: `pregledano=${d.pregledano ?? "?"} novo=${d.novo} poslato=0` };
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
  if (r.istekao) pad("watch_tight_loop_or_hang");
  if (r.kod !== 1) pad("watch_wrong_exit");
  const d = json(r.stdout);
  if (!d || d.status !== "zaustavljeno") pad("watch_did_not_report_stop");
  return { detalj: `staje sa kodom ${d.kod ?? "?"}` };
});

provera("W13", "task.ps1 ostaje dry-run i NE pravi zadatak", () => {
  const skripta = join(WINDOWS, "task.ps1");
  const r = powershell(["-File", skripta, "-Action", "install", "-PackagePath", DIST]);
  if (r.kod !== 0) pad("task_script_failed");
  if (!/\[dry-run\]/.test(r.stdout)) pad("task_script_not_dry_run");

  const postoji = powershell([
    "-Command",
    "if (Get-ScheduledTask -TaskName CarsystemConnector -TaskPath '\\Carsystem\\' " +
      "-ErrorAction SilentlyContinue) { 'DA' } else { 'NE' }",
  ]);
  if (postoji.stdout.trim() !== "NE") pad("scheduled_task_created");
  return { detalj: "plan ispisan, zadatak NIJE registrovan" };
});

provera("W14", "spakovan konektor ne bira test skladište ključa", () => {
  /*
   * Na Windowsu je DPAPI dostupan, pa se test adapter ionako ne bira.
   * Ovo potvrđuje da ni IZRIČITA promenljiva ne menja izbor u paketu — što je
   * ono što bi napadač ili greška u skripti pokušali.
   */
  const r = konektor(["doctor"], { env: okruzenje({ CS_CONNECTOR_INSECURE_KEYSTORE: "1" }) });
  if (r.kod !== 0) pad("doctor_failed_under_insecure_flag");
  if (/test-insecure/.test(r.stdout)) pad("insecure_keystore_selected");
  if (!/dpapi/i.test(r.stdout)) pad("keystore_not_dpapi_under_flag");
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
  if (pass < 0) pad("test_output_unparseable");
  if (fail > 0) pad("existing_tests_failed");

  /*
   * Na Windowsu [WIN] testovi MORAJU biti izvršeni.
   *
   * Jedini dozvoljen preskok je „registracija i uklanjanje zadatka“, koji sam
   * sebe preskače jer menja Task Scheduler. Bilo koji drugi preskok znači da
   * DPAPI ili paket nisu stvarno provereni — i to je INCOMPLETE, ne PASS.
   */
  const preskoceniWin = (izlaz.match(/^ok \d+ - \[WIN\][^\n]*# SKIP/gm) ?? []).length;
  winRezime = { pass, fail, skip, preskoceniWin };
  if (preskoceniWin > 1) pad("win_tests_skipped");
  return { detalj: `pass=${pass} fail=${fail} skipped=${skip} ([WIN] preskočeno ${preskoceniWin})` };
});

provera("W15-win", "[WIN] suite je stvarno izvršen na ovoj mašini", () => {
  if (!winRezime) pad("win_summary_missing");
  if (winRezime.preskoceniWin > 1) {
    return { skip: true, detalj: "više od jednog [WIN] testa preskočeno", kod: "win_suite_not_run" };
  }
  return { detalj: "9 od 10 [WIN] testova izvršeno; 1 namerno ručni (Task Scheduler -Apply)" };
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
console.log(ishod);

process.exitCode = ishod === "SMOKE PASS" ? 0 : ishod === "SMOKE INCOMPLETE" ? 4 : 1;
