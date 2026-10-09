import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Pakuje konektor u samostalan folder.
 *
 * Cilj: `dist/` se kopira na kancelarijski računar i radi bez repozitorijuma,
 * bez Next aplikacije, bez `DATABASE_URL` i bez mreže pri pokretanju.
 *
 * Struktura NAMERNO preslikava repozitorijum
 * ------------------------------------------
 * `dist/lib/...`, `dist/contracts/...`, `dist/connector/...` — tačno isti
 * relativni odnosi kao u izvoru. Zato isti `import "../../lib/..."` radi na oba
 * mesta i pakovanje ne mora da prepisuje nijedan uvoz. Prepisivanje uvoza pri
 * pakovanju je tačno ono mesto na kome se paket tiho raziđe sa izvorom.
 *
 * Posebno: `lib/sync/contract/validate.mjs` čita ugovor sa diska preko
 * `../../../contracts/...`. Iz `dist/lib/sync/contract/` to je `dist/contracts/` —
 * pa šema mora biti tamo, i jeste.
 */

const OVDE = dirname(fileURLToPath(import.meta.url));
const KONEKTOR = resolve(OVDE, "..");
const KOREN = resolve(KONEKTOR, "..");
const DIST = join(KONEKTOR, "dist");

/** Zajednički moduli — po jedan izvor istine, kopiran bez izmene. */
const MODULI = [
  "lib/pdf/biznisoftLayout.mjs",
  "lib/backup/deviceReport.mjs",
  "lib/sync/device/signing.mjs",
  "lib/sync/contract/canonical.mjs",
  "lib/sync/contract/decimal.mjs",
  "lib/sync/contract/fromParsedDocument.mjs",
  "lib/sync/contract/schemaValidator.mjs",
  "lib/sync/contract/validate.mjs",
  "contracts/invoice-ingest/v1/schema.json",
];

/**
 * Runtime zavisnosti, kopirane iz repozitorijuma.
 *
 * Namerno se NE poziva `npm install` u `dist`: to bi tražilo mrežu na mašini na
 * kojoj se pakuje i moglo bi da povuče drugu verziju od one koju su testovi
 * videli. Kopira se tačno ono što je u lockfile-u.
 */
const ZAVISNOSTI = [
  "ajv",
  "unpdf",
  // Tranzitivne zavisnosti `ajv`-a.
  "fast-deep-equal",
  "fast-uri",
  "json-schema-traverse",
  "require-from-string",
];

function kopiraj(rel, ciljRel = rel) {
  const izvor = join(KOREN, rel);
  const cilj = join(DIST, ciljRel);
  mkdirSync(dirname(cilj), { recursive: true });
  cpSync(izvor, cilj, { recursive: true });
}

console.log("Pakovanje konektora…");
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

/* --- 1. Zajednički moduli i ugovor. ------------------------------------- */
for (const m of MODULI) kopiraj(m);

/* --- 2. `parseDocument.ts` → JS. ---------------------------------------- */
/*
 * Jedini TypeScript fajl u lancu. Prevodi se `tsc`-om koji je već devDependency
 * projekta — bez bundlera i bez nove zavisnosti.
 *
 * `--module es2022` je OBAVEZAN, ne stil: `nodenext` bira CommonJS ili ESM po
 * najbližem `package.json`, a koren projekta nema `"type": "module"` — pa bi
 * emitovao `require()` i paket bi pukao pri prvom pokretanju. `es2022` emituje
 * ESM bez obzira na okolinu.
 *
 * Uvoz `./biznisoftLayout.mjs` ostaje netaknut i nalazi kopiran `.mjs` pored
 * sebe. Zato je taj uvoz u izvoru relativan, a ne `@/` alias — TypeScript alias
 * ne prepisuje pri emitovanju.
 */
console.log("  prevodim parseDocument.ts…");
mkdirSync(join(DIST, "lib/pdf"), { recursive: true });
execFileSync(
  process.execPath,
  [
    join(KOREN, "node_modules/typescript/bin/tsc"),
    join(KOREN, "lib/pdf/parseDocument.ts"),
    "--outDir", join(DIST, "lib/pdf"),
    "--module", "es2022",
    "--moduleResolution", "bundler",
    "--target", "es2022",
    "--skipLibCheck",
  ],
  { stdio: "inherit", cwd: KOREN },
);

/* --- 3. Izvor konektora. ------------------------------------------------- */
kopiraj("connector/src", "connector/src");
kopiraj("connector/bin", "connector/bin");

/* --- 4. Zavisnosti. ------------------------------------------------------ */
for (const z of ZAVISNOSTI) {
  const izvor = join(KOREN, "node_modules", z);
  if (!existsSync(izvor)) throw new Error(`Nedostaje zavisnost u node_modules: ${z}`);
  kopiraj(join("node_modules", z), join("node_modules", z));
}

/* --- 5. Manifest paketa. ------------------------------------------------- */
/*
 * `type: module` je obavezan: svi moduli su ESM, a bez ovoga bi `.js` iz
 * `parseDocument` bio protumačen kao CommonJS.
 */
const manifest = {
  name: "carsystem-connector",
  version: JSON.parse(
    // Verzija se čita iz `connector/package.json`, da postoji jedno mesto.
    execFileSync(process.execPath, ["-p", "JSON.stringify(require(process.argv[1]))",
      join(KONEKTOR, "package.json")], { encoding: "utf8" }),
  ).version,
  private: true,
  type: "module",
  bin: { "carsystem-connector": "./connector/bin/connector.mjs" },
  engines: { node: ">=22.0.0" },
  napomena:
    "Samostalan paket. Ne zahteva repozitorijum, Next aplikaciju ni DATABASE_URL. " +
    "Zavisnosti su kopirane iz lockfile-a projekta.",
};
writeFileSync(join(DIST, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

/* --- 6. Pokretač koji postavlja produkcioni režim. ----------------------- */
/*
 * `CS_CONNECTOR_PACKAGED=1` je ono što u paketu ODBIJA test skladište ključa.
 * Postavlja se u pokretaču, ne u kodu — da se ne može zaboraviti pri pakovanju,
 * i da razvojno pokretanje iz repozitorijuma ostane moguće.
 *
 * `--no-warnings` skriva `ExperimentalWarning` za `node:sqlite`; status se i
 * dalje prijavljuje kroz `doctor`, pa se ne gubi.
 */
/*
 * Izlazni kod MORA da preživi `endlocal`.
 *
 * Batch fajl vraća ERRORLEVEL poslednje naredbe, a to je bio `endlocal` — koji
 * uspeva uvek. Zbog toga je `cmd.exe /c connector.cmd` vraćao 0 i kad je
 * konektor pao: Task Scheduler bi neuspeo ciklus prijavio kao uspešan, a
 * `watch` koji staje zbog neispravne konfiguracije izgledao bi kao uredan
 * završetak. Prvi Windows smoke je to i izmerio (`W12: watch_wrong_exit`).
 *
 * `endlocal & exit /b %CS_RC%` je jedini ispravan oblik: cela linija se parsira
 * pre izvršavanja, pa se `%CS_RC%` proširi DOK promenljiva još postoji, a
 * `exit /b` postavi kod tek pošto je `endlocal` vratio okruženje.
 *
 * `connector.sh` istu stvar rešava sa `exec` i nikad nije imao ovaj problem.
 */
writeFileSync(
  join(DIST, "connector.cmd"),
  [
    "@echo off",
    "setlocal",
    "set CS_CONNECTOR_PACKAGED=1",
    'node --no-warnings "%~dp0connector\\bin\\connector.mjs" %*',
    "set CS_RC=%ERRORLEVEL%",
    "endlocal & exit /b %CS_RC%",
    "",
  ].join("\r\n"),
);
writeFileSync(
  join(DIST, "connector.sh"),
  [
    "#!/bin/sh",
    "# Pokretac za razvoj i testove; na Windowsu se koristi connector.cmd.",
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'CS_CONNECTOR_PACKAGED=1 exec node --no-warnings "$DIR/connector/bin/connector.mjs" "$@"',
    "",
  ].join("\n"),
  { mode: 0o755 },
);

console.log(`Paket: ${DIST}`);
