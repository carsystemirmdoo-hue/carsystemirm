import { execFileSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HANDOFF_ZAGLAVLJE,
  proveriHandoff,
  proveriRunbook,
  proveriStartHere,
  runnerProvere,
} from "./smoke-docs-contract.mjs";

/**
 * Sklapa prenosiv Windows smoke paket.
 *
 * ODVOJEN od `connector:build` namerno. Normalan paket koji ide na
 * kancelarijski računar NE SME da nosi testove ni fixtures — to je teret i
 * dodatna površina. Smoke paket ih nosi zato što mu je jedini posao da ih
 * pokrene, jednom, pod nadzorom.
 *
 *   npm run connector:smoke:package
 *
 * Ne preuzima i ne pakuje Node; runtime se instalira zasebno, sa nodejs.org.
 */

const OVDE = dirname(fileURLToPath(import.meta.url));
const KONEKTOR = resolve(OVDE, "..");
const KOREN = resolve(KONEKTOR, "..");
const DIST = join(KONEKTOR, "dist");

/* =========================================================================
 * Allowlista
 * ====================================================================== */

/**
 * IZRIČIT spisak, nikad „kopiraj folder pa filtriraj“.
 *
 * Deny-lista propušta ono na šta niko nije pomislio; allowlista propušta samo
 * ono što je neko imenovao. U paketu koji izlazi iz firme to je jedina razlika
 * koja se broji.
 */
const ULAZI = [
  // Spakovan izlaz `connector:build`.
  { izvor: "connector/dist", cilj: "connector/dist", tip: "folder" },

  /*
   * Testovi koji se na Windowsu STVARNO izvršavaju.
   *
   * Razrešavaju `../dist`, `../windows` i `../../fixtures`, pa struktura paketa
   * mora da preslika repozitorijum — zato ovi ciljevi, a ne ravan folder.
   */
  { izvor: "connector/test/pure.test.mjs", cilj: "connector/test/pure.test.mjs", tip: "fajl" },
  { izvor: "connector/test/paths.test.mjs", cilj: "connector/test/paths.test.mjs", tip: "fajl" },
  { izvor: "connector/test/scanner-store.test.mjs", cilj: "connector/test/scanner-store.test.mjs", tip: "fajl" },
  { izvor: "connector/test/commands.test.mjs", cilj: "connector/test/commands.test.mjs", tip: "fajl" },
  { izvor: "connector/test/windows-smoke.test.mjs", cilj: "connector/test/windows-smoke.test.mjs", tip: "fajl" },
  /*
   * WIN-INSTALL-01 korekcija: proverava iste skripte ispod, statički
   * (parsiranje, dry-run, forbidden-path, disposable-folder ACL) bez
   * administratorskih prava. Čita i `../bin/connector.mjs` i `../README.md`
   * (izvorni tekst, ne `dist/`) — zato oba moraju biti u paketu, ispod.
   */
  { izvor: "connector/test/windows-install-hardening.test.mjs", cilj: "connector/test/windows-install-hardening.test.mjs", tip: "fajl" },

  // Windows skripte; sve su podrazumevano dry-run.
  { izvor: "connector/windows/task.ps1", cilj: "connector/windows/task.ps1", tip: "fajl" },
  { izvor: "connector/windows/harden-state-dir.ps1", cilj: "connector/windows/harden-state-dir.ps1", tip: "fajl" },
  /*
   * `task.ps1`, `harden-install-dir.ps1` i `verify-invoice-folder.ps1` sve
   * troje bezuslovno dot-source-uju `PathGuards.ps1` (`. (Join-Path
   * $PSScriptRoot 'PathGuards.ps1')`) — bez njega ijedan poziv, čak i
   * `-Action status`, puca odmah na učitavanju. Ranija allowlista je nosila
   * `task.ps1` bez ovog fajla, pa spakovan `task.ps1` NIJE mogao da se
   * pokrene — otkriveno pri pripremi P0-WIN-02A paketa.
   */
  { izvor: "connector/windows/PathGuards.ps1", cilj: "connector/windows/PathGuards.ps1", tip: "fajl" },
  /*
   * Kancelarijska (Production) strogost — nose se radi PowerShell parser
   * provere i radi kompletnosti korigovanog WIN-01 paketa. `-Apply` se u ovoj
   * fazi (kućni, non-admin smoke) NIKAD ne poziva — vidi START-HERE.md.
   */
  { izvor: "connector/windows/harden-install-dir.ps1", cilj: "connector/windows/harden-install-dir.ps1", tip: "fajl" },
  { izvor: "connector/windows/verify-invoice-folder.ps1", cilj: "connector/windows/verify-invoice-folder.ps1", tip: "fajl" },
  /*
   * Kancelarijska instalacija (docs/b2b/49). Smoke ih NE izvršava; nose se jer
   * ih statički testovi (`windows-install-hardening.test.mjs`) čitaju.
   */
  { izvor: "connector/windows/instaliraj.ps1", cilj: "connector/windows/instaliraj.ps1", tip: "fajl" },
  { izvor: "connector/windows/podesi.ps1", cilj: "connector/windows/podesi.ps1", tip: "fajl" },
  { izvor: "connector/windows/provera.ps1", cilj: "connector/windows/provera.ps1", tip: "fajl" },
  { izvor: "connector/windows/vrati-prethodnu.ps1", cilj: "connector/windows/vrati-prethodnu.ps1", tip: "fajl" },
  /*
   * Referentni runbook za KASNIJU kancelarijsku instalaciju — ne za ovaj
   * kućni smoke. Nosi se radi pregleda, ne radi izvršavanja u ovoj fazi.
   */
  { izvor: "connector/windows/OFFICE-INSTALL.md", cilj: "connector/windows/OFFICE-INSTALL.md", tip: "fajl" },

  /*
   * Izvorni tekst (ne `dist/`) — `windows-install-hardening.test.mjs` čita
   * baš ove fajlove da bi potvrdio da `--packaged`/`--config` zastavice
   * postoje u kodu i da je Autostart odeljak dokumentovan. Bez njih ovde,
   * ta dva testa bi pukla na ENOENT čim se paket raspakuje.
   */
  { izvor: "connector/bin/connector.mjs", cilj: "connector/bin/connector.mjs", tip: "fajl" },
  { izvor: "connector/README.md", cilj: "connector/README.md", tip: "fajl" },

  /*
   * SAMO dva fixture-a koja testovi stvarno čitaju, plus njihov README.
   *
   * README ide uz njih jer je on dokaz da su izmišljeni; bez njega bi na tuđem
   * računaru bili samo „neki PDF-ovi“.
   */
  { izvor: "fixtures/dev/biznisoft/jedna-stavka.pdf", cilj: "fixtures/dev/biznisoft/jedna-stavka.pdf", tip: "fajl" },
  { izvor: "fixtures/dev/biznisoft/vise-stavki.pdf", cilj: "fixtures/dev/biznisoft/vise-stavki.pdf", tip: "fajl" },
  { izvor: "fixtures/dev/biznisoft/README.md", cilj: "fixtures/dev/biznisoft/README.md", tip: "fajl" },

  // Runner i uputstvo.
  { izvor: "connector/smoke/run-smoke.mjs", cilj: "smoke/run-smoke.mjs", tip: "fajl" },
  /*
   * Runtime ugovor je zaseban modul da bi bio testabilan van Windows-a; runner
   * ga uvozi, pa mora u paket.
   */
  { izvor: "connector/smoke/runtime-contract.mjs", cilj: "smoke/runtime-contract.mjs", tip: "fajl" },
  /*
   * Dijagnostika PowerShell/DPAPI okruženja. Ne pokreće se sama — poziva se
   * izričito, `RUN-SMOKE.cmd diagnose`, kada smoke padne a uzrok se ne vidi.
   */
  { izvor: "connector/smoke/diagnose.mjs", cilj: "smoke/diagnose.mjs", tip: "fajl" },
  /*
   * Jezgro dijagnostike je odvojeno da bi bilo testabilno bez Windowsa;
   * pokretač ga uvozi, pa mora u paket.
   */
  { izvor: "connector/smoke/diagnose-core.mjs", cilj: "smoke/diagnose-core.mjs", tip: "fajl" },
  { izvor: "connector/smoke/cleanup.mjs", cilj: "smoke/cleanup.mjs", tip: "fajl" },
  { izvor: "connector/smoke/RUN-SMOKE.cmd", cilj: "smoke/RUN-SMOKE.cmd", tip: "fajl" },
  { izvor: "connector/smoke/START-HERE.md", cilj: "START-HERE.md", tip: "fajl" },
];

/* =========================================================================
 * Odbijanje
 * ====================================================================== */

/** Šta nikad ne sme da uđe, ma kroz koji ulaz. */
const ZABRANJENO = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.env/,
  /(^|\/)\.next/,
  /(^|\/)\.DS_Store$/,
  /(^|\/)__MACOSX(\/|$)/,
  /\.(db|sqlite|sqlite3|log|pem|key|p12|pfx|crt)$/i,
  /(^|\/)id_(rsa|ed25519)/,
  /(^|\/)node_modules\/(next|react|typescript)(\/|$)/,
];

/** Tekstualni sadržaj koji odaje tajnu ili tuđu mašinu. */
const SUMNJIV_SADRZAJ = [
  { ime: "postgres konekcija", re: /postgres(ql)?:\/\/[^\s"']+/ },
  { ime: "privatni ključ", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { ime: "e-pošta", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { ime: "AUTH_SECRET vrednost", re: /AUTH_SECRET\s*=\s*\S+/ },
  { ime: "QA master ključ", re: /QA_MFA_MASTER_KEY\w*\s*=\s*\S+/ },
];

/**
 * Pogoci koji SU pregledani i svesno ostaju.
 *
 * Spisak je uzak i imenovan po fajlu: „ovo znam i evo zašto“, a ne globalno
 * gašenje provere. Svaki nov pogodak i dalje obara pakovanje.
 */
const PREGLEDANO = [
  {
    fajl: "connector/test/scanner-store.test.mjs",
    razlog:
      "`/Users/tajna/Fakture/…` je izmišljen ULAZ negativnog testa; test dokazuje " +
      "da `status` tu putanju NE prikaže.",
  },
  {
    fajl: "connector/test/windows-smoke.test.mjs",
    razlog: "`C:\\Fakture\\a.pdf` je izmišljen ulaz testa; ne postoji ni na jednoj mašini.",
  },
  {
    fajl: "connector/test/paths.test.mjs",
    razlog:
      "Izmišljen Windows file-URL vektor (`file:///C:/Users/Vlasnik/…`) koji test i " +
      "postoji da bi proverio.",
  },
  {
    fajl: "START-HERE.md",
    razlog: "Uputstvo vlasniku; korisničko ime je mesto-držač `<tvoj nalog>`.",
  },
  {
    fajl: "connector/windows/PathGuards.ps1",
    razlog: "`C:\\Program Files\\CarsystemConnector` je primer putanje u komentaru koji objašnjava allow-listu; nije stvarna mašina.",
  },
  {
    fajl: "connector/windows/harden-install-dir.ps1",
    razlog: "`C:\\Program Files\\CarsystemConnector` u `.EXAMPLE` blokovima je ilustrativan poziv iz dokumentacije skripte, ne stvarna putanja.",
  },
  {
    fajl: "connector/windows/verify-invoice-folder.ps1",
    razlog: "`C:\\BizniSoft\\Izvoz\\Fakture` u `.EXAMPLE` bloku je izmišljen primer BizniSoft foldera, ne stvarna putanja.",
  },
  {
    fajl: "connector/windows/instaliraj.ps1",
    razlog: "`C:\\Program Files\\CarsystemConnector` i `C:\\Users\\nalog\\...` su primeri iz zaglavlja/uputstva skripte, ne stvarna mašina.",
  },
  {
    fajl: "connector/windows/podesi.ps1",
    razlog: "`C:\\Program Files\\CarsystemConnector` u zaglavlju je primer poziva, ne stvarna mašina.",
  },
  {
    fajl: "connector/windows/provera.ps1",
    razlog: "`C:\\Program Files\\CarsystemConnector` u zaglavlju je primer poziva, ne stvarna mašina.",
  },
  {
    fajl: "connector/windows/vrati-prethodnu.ps1",
    razlog: "`C:\\Program Files\\CarsystemConnector` je primer u zaglavlju skripte, ne stvarna mašina.",
  },
  {
    fajl: "connector/windows/OFFICE-INSTALL.md",
    razlog:
      "Runbook za KASNIJU kancelarijsku instalaciju — pun je primera putanja " +
      "(`C:\\Program Files\\CarsystemConnector`, `C:\\BizniSoft\\Izvoz\\Fakture`, " +
      "`C:\\ProgramData\\CarsystemConnector\\...`) koje operater kuca ručno na " +
      "SVOJOJ mašini; nijedna ne identifikuje mašinu na kojoj je paket sastavljen.",
  },
  {
    fajl: "connector/README.md",
    razlog: "`C:\\\\BizniSoft\\\\Izvoz\\\\Fakture` je primer vrednosti u `config.json` šabloj, ne stvarna putanja.",
  },
];

/**
 * Izuzetak važi SAMO za klasu „apsolutna putanja“, i samo u imenovanim fajlovima.
 *
 * Nije globalno gašenje: e-pošta, `postgres://`, privatni ključ i vrednosti
 * tajni se u tim istim fajlovima i dalje traže. Razlika je u tome što je
 * apsolutna putanja u njima IZMIŠLJEN ULAZ testa ili mesto-držač u uputstvu —
 * a svaki NOV fajl sa apsolutnom putanjom i dalje obara pakovanje.
 */
const apsolutnaPregledana = (rel) => PREGLEDANO.some((x) => rel.endsWith(x.fajl));

const TUDJ_KOD = /(^|\/)node_modules\//;

const TEKSTUALNI = /\.(mjs|js|json|md|txt|cmd|sh|ps1|ts)$/i;

/* =========================================================================
 * Pakovanje
 * ====================================================================== */

function git(...args) {
  return execFileSync("git", args, { cwd: KOREN, encoding: "utf8" }).trim();
}

console.log("Sklapanje Windows smoke paketa…");

/* --- 1. Polazi se od ČISTOG, poznatog HEAD-a. --------------------------- */
/*
 * Paket koji nastane nad prljavim stablom ne odgovara nijednom commit-u, pa
 * kasniji nalaz sa Windowsa nema čemu da se pripiše.
 */
const prljavo = git("status", "--porcelain");
if (prljavo !== "") {
  console.error("Radno stablo nije čisto. Paket mora nastati nad poznatim HEAD-om.");
  console.error(prljavo);
  process.exit(1);
}
const HEAD = git("rev-parse", "HEAD");
const KRATKI = HEAD.slice(0, 7);
const GRANA = git("rev-parse", "--abbrev-ref", "HEAD");

if (!existsSync(join(DIST, "package.json"))) {
  console.error("Nema `connector/dist`. Pokreni prvo: npm run connector:build");
  process.exit(1);
}

/* --- 1b. Papir mora da odgovara runneru — PRE nego što išta nastane. ------ */
/*
 * Predat je paket `2ffb15b` uz `START-HERE.md` koji je i dalje tvrdio `90374b1`
 * i tražio rezultat pod imenom koje runner nikada ne napiše, dok je runbook
 * tražio „10/10" nad runnerom od šesnaest provera i nalagao brisanje STVARNE
 * fakture kao dokaz da je folder read-only.
 *
 * `MANIFEST.md` to nije mogao da uhvati: on dokazuje da su fajlovi neizmenjeni,
 * ne da im je sadržaj i dalje tačan. Zato se ovde pakovanje ODBIJA.
 */
const RUNBOOK = "docs/b2b/recommendation-office-validation-runbook.md";
const runnerIdevi = runnerProvere(readFileSync(join(KOREN, "connector/smoke/run-smoke.mjs"), "utf8"));

const papir = [
  ["connector/smoke/START-HERE.md", proveriStartHere({
    tekst: readFileSync(join(KOREN, "connector/smoke/START-HERE.md"), "utf8"),
    runnerIdevi,
  })],
  [RUNBOOK, proveriRunbook({
    tekst: readFileSync(join(KOREN, RUNBOOK), "utf8"),
    runnerIdevi,
  })],
];

const papirniNalazi = papir.filter(([, n]) => n.length > 0);
if (papirniNalazi.length > 0) {
  console.error("Pakovanje ODBIJENO — uputstvo se ne poklapa sa runnerom.");
  for (const [fajl, nalazi] of papirniNalazi) {
    console.error(`  ${fajl}:`);
    for (const n of nalazi) console.error(`    - ${n}`);
  }
  process.exit(1);
}
console.log(`Papir provere: ${runnerIdevi.length} provera runnera, uputstva se poklapaju.`);

const IME = `carsystem-windows-smoke-${KRATKI}`;
const IZLAZ = process.env.CS_SMOKE_OUT_DIR
  ? resolve(process.env.CS_SMOKE_OUT_DIR)
  : join(KOREN, "..", "Carsystem-Windows-Smoke");
const STAGE = join(IZLAZ, IME);

mkdirSync(IZLAZ, { recursive: true });
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

/* --- 2. Kopiranje po allowlisti. ---------------------------------------- */
for (const u of ULAZI) {
  const izvor = join(KOREN, u.izvor);
  if (!existsSync(izvor)) {
    console.error(`Nedostaje ulaz iz allowliste: ${u.izvor}`);
    process.exit(1);
  }
  const cilj = join(STAGE, u.cilj);
  mkdirSync(dirname(cilj), { recursive: true });
  cpSync(izvor, cilj, { recursive: u.tip === "folder" });
}

/* --- 3. Metapodaci se ČITAJU iz izvora, ne kucaju. ---------------------- */
const izvod = (rel, re) => {
  const m = readFileSync(join(KOREN, rel), "utf8").match(re);
  if (!m) throw new Error(`Ne mogu da pročitam metapodatak iz ${rel}`);
  return m[1];
};

const meta = {
  sourceHead: HEAD,
  shortHead: KRATKI,
  sourceBranch: GRANA,
  connectorVersion: JSON.parse(readFileSync(join(KONEKTOR, "package.json"), "utf8")).version,
  protocolVersion: izvod("lib/sync/device/signing.mjs", /PROTOCOL_VERSION\s*=\s*"([^"]+)"/),
  storeSchema: Number(izvod("connector/src/store.mjs", /SEMA_VERZIJA\s*=\s*(\d+)/)),
  commandType: izvod("connector/src/commands.mjs", /PODRZAN_TIP\s*=\s*"([^"]+)"/),
  commandVersion: Number(izvod("connector/src/commands.mjs", /PODRZANA_VERZIJA\s*=\s*(\d+)/)),
  requiredNode: "24.14.x (Windows x64, zvanični LTS sa nodejs.org)",
  testScope: [
    "IZVRŠAVA SE — doctor, init, export-key, dry-run, status, poll-once, watch, " +
      "DPAPI CurrentUser, node:sqlite restart, Task Scheduler DRY-RUN plan",
    "NE IZVRŠAVA — slanje serveru, registracija uređaja, feature gate, " +
      "trajni Scheduled Task, izmena ACL-a",
  ],
  napomena:
    "Prvi izolovani smoke. Nije kancelarijska prihvatna proba i nije produkciono puštanje. " +
    "Node se NE isporučuje uz paket.",
};
writeFileSync(join(STAGE, "smoke/package-meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

/* --- 4. Provera sadržaja. ----------------------------------------------- */
function sviFajlovi(koren) {
  const out = [];
  const hodaj = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) hodaj(p);
      else out.push(p);
    }
  };
  hodaj(koren);
  // Deterministički redosled — isti ulaz daje isti manifest i isti ZIP.
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const fajlovi = sviFajlovi(STAGE);
const rel = (p) => relative(STAGE, p).split(sep).join("/");

const odbijeni = [];
const nalazi = [];

for (const f of fajlovi) {
  const r = rel(f);
  if (ZABRANJENO.some((re) => re.test(r))) odbijeni.push(r);
  if (!TEKSTUALNI.test(r) || TUDJ_KOD.test(r)) continue;

  const sadrzaj = readFileSync(f, "utf8");
  for (const s of SUMNJIV_SADRZAJ) {
    // Tajne nemaju izuzetak ni u jednom fajlu.
    if (s.re.test(sadrzaj)) nalazi.push(`${r}: ${s.ime}`);
  }
  /*
   * Apsolutne putanje se traže odvojeno: nisu tajna, ali odaju mašinu na kojoj
   * je paket nastao i ne smeju da izađu bez razloga.
   */
  /*
   * Windows disk se traži samo ispred STVARNOG segmenta putanje.
   *
   * `[A-Za-z]:\\` samo po sebi pogađa i regex escape-ove u kodu — `PDV:\s*` i
   * `računa:\s*` su tako prijavljeni kao apsolutne putanje. Zato negativni
   * lookahead na `\s`, `\d`, `\w`, `\b`, `\n`, `\r`, `\t`, `\.`: to su
   * escape-ovi, ne folderi.
   */
  const APSOLUTNA = /(?:\/Users\/|\/home\/|[A-Za-z]:\\(?![sSdDwWbBnrt.]))[^\s"'`)]{3,}/;
  if (!apsolutnaPregledana(r) && APSOLUTNA.test(sadrzaj)) {
    nalazi.push(`${r}: apsolutna putanja`);
  }
}

if (odbijeni.length > 0 || nalazi.length > 0) {
  console.error("Pakovanje ODBIJENO.");
  for (const o of odbijeni) console.error(`  zabranjen fajl: ${o}`);
  for (const n of [...new Set(nalazi)]) console.error(`  sumnjiv sadržaj: ${n}`);
  process.exit(1);
}

/* --- 5. Izveštaj o proveri i manifest. ---------------------------------- */
writeFileSync(
  join(STAGE, "smoke/PACKAGE-SCAN.md"),
  [
    "# Provera sadržaja paketa",
    "",
    `Automatska provera je pokrenuta nad svih ${fajlovi.length} fajlova pre pakovanja,`,
    "iz `connector/scripts/package-smoke.mjs`. Sadržaj je sastavljen po IZRIČITOJ",
    "allowlisti — ništa nije ušlo zato što je „bilo u folderu“.",
    "",
    "## Bez pogodaka",
    "",
    "`.git`, `.env`, `.next`, web `node_modules`, `*.db`, `*.sqlite`, `*.log`,",
    "`*.pem`, `*.key`, `*.p12`, `id_rsa`, `postgres://`, `BEGIN PRIVATE KEY`,",
    "`AUTH_SECRET`, `QA_MFA_MASTER_KEY`, e-pošta, apsolutne putanje.",
    "",
    "## Opseg provere sadržaja",
    "",
    "Sadržaj se čita u NAŠIM fajlovima. `connector/dist/node_modules` je tuđi kod",
    "prepisan iz lockfile-a (`ajv`, `unpdf` i njihove zavisnosti): autorska e-pošta",
    "u tuđem `package.json` nije naš podatak i ne govori ništa o ovoj mašini.",
    "Zabrana po IMENU fajla važi svuda, uključujući i njih.",
    "",
    "## Pregledano i svesno zadržano",
    "",
    "| Fajl | Zašto apsolutna putanja u njemu ostaje |",
    "|---|---|",
    ...PREGLEDANO.map((p) => `| \`${p.fajl}\` | ${p.razlog} |`),
    "",
    "## Sintetički materijal",
    "",
    "Oba PDF-a su generisana determinističkim računom iz projekta: `SINTETICKI",
    "ARTIKAL`, PIB serije `1000000xx`, šifre artikala `9000xx`. Nijedna vrednost",
    "ne potiče iz stvarnog dokumenta — vidi `fixtures/dev/biznisoft/README.md`.",
    "Stvarni PDF uzorci ostaju van Gita i NISU u ovom paketu.",
    "",
    "## Node runtime",
    "",
    "Node **nije** u paketu i ne preuzima se. Instalira se zasebno, zvanični",
    "Windows x64 Node 24 LTS sa nodejs.org.",
    "",
  ].join("\n"),
);

const konacni = sviFajlovi(STAGE).filter((f) => rel(f) !== "MANIFEST.md");
const redovi = konacni.map((f) => {
  const b = readFileSync(f);
  return { sha: createHash("sha256").update(b).digest("hex"), n: b.length, p: rel(f) };
});

writeFileSync(
  join(STAGE, "MANIFEST.md"),
  [
    `# Manifest — ${IME}`,
    "",
    `Izvorni HEAD: ${HEAD}`,
    `Grana:        ${GRANA}`,
    `Runtime:      ${meta.requiredNode}`,
    "",
    "Opseg testa:",
    ...meta.testScope.map((x) => `  ${x}`),
    "",
    "Provera na Windows-u (PowerShell, iz raspakovanog foldera):",
    "",
    "```powershell",
    "Get-ChildItem -Recurse -File | ForEach-Object {",
    "  '{0}  {1}' -f (Get-FileHash $_ -Algorithm SHA256).Hash.ToLower(),",
    "               (Resolve-Path $_ -Relative)",
    "}",
    "```",
    "",
    `Ukupno fajlova: ${redovi.length}`,
    "",
    "| SHA-256 | bajtova | putanja |",
    "|---|---|---|",
    ...redovi.map((r) => `| \`${r.sha}\` | ${r.n} | \`${r.p}\` |`),
    "",
  ].join("\n"),
);

/* --- 6. ZIP. ------------------------------------------------------------ */
const ZIP = join(IZLAZ, `${IME}.zip`);
rmSync(ZIP, { force: true });
/*
 * `-X` izbacuje macOS extended atribute; bez njega ZIP nosi `__MACOSX` smeće
 * i hash se menja između mašina bez ijedne izmene sadržaja.
 */
execFileSync("zip", ["-q", "-r", "-X", ZIP, IME], { cwd: IZLAZ });

/* --- 7. Provera ZIP-a POSLE pakovanja. ---------------------------------- */
const lista = execFileSync("unzip", ["-Z1", ZIP], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .map((x) => x.replace(`${IME}/`, ""))
  // Koren arhive posle skidanja prefiksa postaje prazan niz — nije fajl.
  .filter((x) => x !== "" && !x.endsWith("/"));

const uZipu = new Set(lista);
const ocekivani = new Set(redovi.map((r) => r.p).concat("MANIFEST.md"));
const visak = [...uZipu].filter((x) => !ocekivani.has(x));
const manjak = [...ocekivani].filter((x) => !uZipu.has(x));

if (visak.length > 0 || manjak.length > 0) {
  console.error("ZIP se ne poklapa sa manifestom.");
  for (const x of visak) console.error(`  višak: ${x}`);
  for (const x of manjak) console.error(`  manjak: ${x}`);
  process.exit(1);
}
for (const x of uZipu) {
  if (ZABRANJENO.some((re) => re.test(x))) {
    console.error(`ZIP nosi zabranjen fajl: ${x}`);
    process.exit(1);
  }
}

const zipSha = createHash("sha256").update(readFileSync(ZIP)).digest("hex");
const zipBajtova = statSync(ZIP).size;

/* --- 8. Handoff PORED arhive. ------------------------------------------- */
/*
 * Arhiva ne može da sadrži sopstveni konačni otisak: otisak nastaje tek kada je
 * zatvorena. Zato ime, hash, veličina i broj fajlova idu u odvojen fajl koji
 * stoji uz nju.
 *
 * Sadrži IME arhive, ne njenu putanju — putanja bi odala mašinu na kojoj je
 * paket nastao, a to je isti razlog zbog kog scan iznad odbija apsolutne
 * putanje u sadržaju.
 */
const HANDOFF_IME = `WINDOWS-HANDOFF-${KRATKI}.md`;
const HANDOFF = join(IZLAZ, HANDOFF_IME);
const zipIme = `${IME}.zip`;

const handoffTekst = [
  `# Windows handoff — ${KRATKI}`,
  "",
  `**${HANDOFF_ZAGLAVLJE}**`,
  "",
  "Ovaj fajl stoji PORED arhive, ne u njoj: arhiva ne može da sadrži sopstveni",
  "konačni otisak. Sve što je ovde napisano proverava se pre nego što se paket",
  "uopšte pokrene.",
  "",
  "## Paket",
  "",
  "| | |",
  "|---|---|",
  `| Arhiva | \`${zipIme}\` |`,
  `| SHA-256 | \`${zipSha}\` |`,
  `| Bajtova | ${zipBajtova} |`,
  `| Fajlova u arhivi | ${redovi.length} |`,
  `| Izvorni HEAD | \`${HEAD}\` |`,
  `| Grana | \`${GRANA}\` |`,
  `| Runtime | ${meta.requiredNode} |`,
  "",
  "## Provera na Windowsu, pre pokretanja",
  "",
  "```powershell",
  `Get-FileHash .\${zipIme} -Algorithm SHA256`,
  "```",
  "",
  "Mora dati hash iz tabele iznad. Ako ne da — paket se ne pokreće.",
  "",
  "## Koraci",
  "",
  "1. Instaliraj zvanični Windows x64 **Node 24 LTS** sa nodejs.org; `node --version`",
  "   mora dati `v24.14.x`.",
  "2. Raspakuj u putanju sa **razmakom i srpskim slovima**, npr.",
  "   `C:\Users\<nalog>\Desktop\Carsystem Smoke ČĆŽŠĐ\`. To je deo provere `W03`.",
  "3. Pokreni `smoke\RUN-SMOKE.cmd`. **Ne kao Administrator.**",
  "4. Jedini prolaz je ispis **`SMOKE PASS`** (izlazni kod 0).",
  "   `SMOKE INCOMPLETE` (4) i `SMOKE FAIL` (1) nisu prolaz. **Ne broj testove** —",
  "   nijedan [WIN] test ne sme biti preskočen. Ručne provere RUCNO-DPAPI-NALOG",
  "   i RUCNO-TASK-APPLY se u rezultatu navode kao MANUAL_NOT_EXECUTED, ne",
  "   pokreću se u ovom prolazu i ne ulaze u SMOKE PASS.",
  "5. Pošalji `windows-smoke-result-" + KRATKI + ".md` iz `%TEMP%\\Carsystem Smoke ČĆŽŠĐ\\`.",
  "   `testovi-tap.log` **ne šalji**.",
  "",
  "Detaljno uputstvo je `START-HERE.md` u samoj arhivi.",
  "",
  "## Šta ovaj prolaz NE radi",
  "",
  "- ne dodiruje nijednu pravu fakturu, ni čitanjem ni pisanjem;",
  "- ne šalje ništa na mrežu (konfiguracija je `https://smoke.invalid`);",
  "- ne registruje uređaj i ne uključuje nijedan feature gate;",
  "- ne pravi Scheduled Task, servis ni autostart;",
  "- ne menja NTFS dozvole i ne traži administratorska prava.",
  "",
  "Provera dozvola nad BizniSoft folderom se u ovom prolazu svodi na **čitanje**",
  "`icacls` ispisa. Aktivna provera dolazi kasnije i izvodi se isključivo nad",
  "namenskim sentinel fajlom, nikada nad pravom fakturom.",
  "",
].join("\n");

writeFileSync(HANDOFF, handoffTekst);

const handoffNalazi = proveriHandoff({
  tekst: handoffTekst,
  zipIme,
  zipSha,
  runnerIdevi,
});
if (handoffNalazi.length > 0) {
  console.error(`Pakovanje ODBIJENO — ${HANDOFF_IME} nije ispravan.`);
  for (const n of handoffNalazi) console.error(`  - ${n}`);
  process.exit(1);
}

/* --- 9. Raniji paketi se NE označavaju ovde. ---------------------------- */
/*
 * Tek `verify-smoke-package.mjs`, posle provere bez ijednog pada, označava
 * ranije pakete kao NEVAZECI. Novi ZIP koji provera odbije ne sme da ostavi
 * stari već proglašen nevažećim.
 */

console.log("");
console.log(`Paket:   ${ZIP}`);
console.log(`HEAD:    ${HEAD} (${GRANA})`);
console.log(`Fajlova: ${redovi.length}`);
console.log(`Bajtova: ${zipBajtova}`);
console.log(`SHA-256: ${zipSha}`);
console.log(`Handoff: ${HANDOFF}`);
console.log("Raniji paketi NISU označeni — to radi `npm run connector:smoke:verify` tek kad prođe.");
console.log("");
console.log("Windows smoke se NE izvršava odavde — paket se prenosi i pokreće na Windowsu.");
