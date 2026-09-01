import { execFileSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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

  // Windows skripte; obe su podrazumevano dry-run.
  { izvor: "connector/windows/task.ps1", cilj: "connector/windows/task.ps1", tip: "fajl" },
  { izvor: "connector/windows/harden-state-dir.ps1", cilj: "connector/windows/harden-state-dir.ps1", tip: "fajl" },

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
    obrazac: /\/Users\/tajna\/Fakture/,
    razlog:
      "Izmišljen ULAZ negativnog testa; test dokazuje da `status` tu putanju NE prikaže.",
  },
];

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
  if (!TEKSTUALNI.test(r)) continue;

  const sadrzaj = readFileSync(f, "utf8");
  for (const s of SUMNJIV_SADRZAJ) {
    const m = sadrzaj.match(s.re);
    if (!m) continue;
    const opravdan = PREGLEDANO.some((p) => r.endsWith(p.fajl) && p.obrazac.test(m[0]));
    if (!opravdan) nalazi.push(`${r}: ${s.ime}`);
  }
  /*
   * Apsolutne putanje se traže odvojeno: nisu tajna, ali odaju mašinu na kojoj
   * je paket nastao i ne smeju da izađu bez razloga.
   */
  for (const m of sadrzaj.matchAll(/(?:\/Users\/|\/home\/|[A-Za-z]:\\)[^\s"'`)]{3,}/g)) {
    const opravdan = PREGLEDANO.some((p) => r.endsWith(p.fajl) && p.obrazac.test(m[0]));
    if (!opravdan) nalazi.push(`${r}: apsolutna putanja`);
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
    "## Pregledano i svesno zadržano",
    "",
    "| Fajl | Šta | Zašto ostaje |",
    "|---|---|---|",
    ...PREGLEDANO.map((p) => `| \`${p.fajl}\` | ${String(p.obrazac)} | ${p.razlog} |`),
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
  .filter((x) => !x.endsWith("/"));

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

console.log("");
console.log(`Paket:   ${ZIP}`);
console.log(`HEAD:    ${HEAD} (${GRANA})`);
console.log(`Fajlova: ${redovi.length}`);
console.log(`Bajtova: ${statSync(ZIP).size}`);
console.log(`SHA-256: ${zipSha}`);
console.log("");
console.log("Windows smoke se NE izvršava odavde — paket se prenosi i pokreće na Windowsu.");
