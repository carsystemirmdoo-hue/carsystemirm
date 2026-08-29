/**
 * Lokalni acceptance test nad PRIVATNIM PDF uzorcima.
 *
 * Ne ulazi u CI i ne čita ništa iz repozitorijuma. Putanja se zadaje spolja:
 *   BIZNISOFT_SAMPLES=~/putanja BIZNISOFT_PREFIX=Fak \
 *     npx tsx --tsconfig db/integration/tsconfig.test.json \
 *       scripts/local/biznisoft-acceptance.mjs
 *
 * `BIZNISOFT_PREFIX` sužava skup na fajlove čije ime počinje datim tekstom;
 * bez njega se čita svaki PDF u folderu, što na opštem folderu daje šum.
 *
 * Ispisuje ISKLJUČIVO anonimne oznake, statuse i brojeve. Nijedan naziv, PIB,
 * adresa, šifra, iznos ni broj dokumenta ne izlazi iz ove skripte — zato se i
 * zove acceptance, a ne dump.
 */
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseBiznisoftPdf } from "../../lib/pdf/extract.ts";

/*
 * Putanja mora biti ZADATA.
 *
 * Ranije se podrazumevalo `~/Downloads`. Skripta bi tada, pokrenuta bez
 * promenljive, prošla kroz lični folder i čitala tuđe PDF-ove — tačno ono što
 * pravilo o privatnosti zabranjuje. Nema bezbedne podrazumevane putanje do
 * privatnih dokumenata, pa je nema ni ovde.
 */
if (!process.env.BIZNISOFT_SAMPLES) {
  console.error(
    "Postavite BIZNISOFT_SAMPLES na folder sa uzorcima.\n" +
      "Podrazumevane putanje nema — skripta ne sme sama da bira šta će čitati.",
  );
  process.exit(1);
}
const dir = process.env.BIZNISOFT_SAMPLES.replace(/^~/, homedir());

const prefix = process.env.BIZNISOFT_PREFIX ?? "";
const files = (await readdir(dir))
  .filter((f) => /\.pdf$/i.test(f) && f.startsWith(prefix))
  .sort();
if (files.length === 0) {
  console.error(`Nema PDF-ova u ${dir}. Postavite BIZNISOFT_SAMPLES.`);
  process.exit(1);
}

console.log(`uzoraka: ${files.length}\n`);
console.log("ozn   str  stavki  status                        zbir");
const tally = {};
const hashes = new Map();
let lineTotal = 0;

for (const [i, name] of files.entries()) {
  const bytes = new Uint8Array(await readFile(path.join(dir, name)));
  const doc = await parseBiznisoftPdf(bytes);
  const label = `U${String(i + 1).padStart(2, "0")}`;
  tally[doc.validationStatus] = (tally[doc.validationStatus] ?? 0) + 1;
  lineTotal += doc.lines.length;
  if (hashes.has(doc.fileHash)) {
    console.log(`  ${label}: DUPLIKAT po hashu sa ${hashes.get(doc.fileHash)}`);
  }
  hashes.set(doc.fileHash, label);
  const zbir = doc.totals.ok ? "ok" : (doc.totals.reason ?? "-");
  console.log(
    `${label}  ${String(doc.pageCount).padStart(3)}  ${String(doc.lines.length).padStart(6)}  ` +
    `${doc.validationStatus.padEnd(28)} ${zbir}`,
  );
}

console.log("\n--- zbirno ---");
for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v}`);
console.log(`  stavki ukupno: ${lineTotal}`);
console.log(`  jedinstvenih otisaka: ${hashes.size} / ${files.length}`);
