/**
 * Provera stvarnih BizniSoft PDF faktura BEZ UPISA — pre prvog uvoza.
 *
 *   BIZNISOFT_SAMPLES=/privatni/folder [BIZNISOFT_PREFIX=Fak] \
 *   [BIZNISOFT_PRIVATE_REPORT=~/.carsystem-private/provera.json] \
 *     npx tsx --tsconfig db/integration/tsconfig.test.json \
 *       scripts/local/biznisoft-readonly-check.mts
 *
 * Isti parser kao portal i konektor; NE dira bazu, mrežu ni originale.
 * Na ekran idu ISKLJUČIVO anonimne oznake (U01…), statusi i brojevi — bez
 * naziva, PIB-a, šifara, iznosa, brojeva dokumenata i imena fajlova.
 *
 * Provera po dokumentu:
 *   - stavke: broj, aritmetika svake stavke (količina × cena − rabat, PDV, bruto);
 *   - iznosi: zbir stavki prema odštampanom ukupnom iznosu;
 *   - PDV: koje stope se pojavljuju (stope nisu lični podatak);
 *   - rabati: koliko stavki ima rabat;
 *   - identitet kupca: postoji li šifra partnera, ispravnost PIB-a (kontrolna cifra);
 *   - duplikati: isti bajtovi (otisak) i isti poslovni broj u različitim fajlovima.
 *
 * Vezu oznaka → fajl, kada je potrebna čoveku, upisuje samo u
 * `BIZNISOFT_PRIVATE_REPORT` (prava 600) — nikad na ekran, nikad u repozitorijum.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseBiznisoftPdf } from "../../lib/pdf/extract.ts";
import { classifyPib } from "../../lib/partners/pib.mjs";

const expand = (p: string) => p.replace(/^~/, homedir());
if (!process.env.BIZNISOFT_SAMPLES) {
  console.error("Postavite BIZNISOFT_SAMPLES na privatni folder sa fakturama. Podrazumevane putanje nema.");
  process.exit(1);
}
const dir = expand(process.env.BIZNISOFT_SAMPLES);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const report = process.env.BIZNISOFT_PRIVATE_REPORT ? expand(process.env.BIZNISOFT_PRIVATE_REPORT) : null;
if (report && path.resolve(report).startsWith(repoRoot + path.sep)) {
  console.error("Privatni izveštaj ne sme biti unutar repozitorijuma.");
  process.exit(1);
}

const prefix = process.env.BIZNISOFT_PREFIX ?? "";
const files = (await readdir(dir)).filter((f) => /\.pdf$/i.test(f) && f.startsWith(prefix)).sort();
if (files.length === 0) {
  console.error("Nema PDF-ova u zadatom folderu.");
  process.exit(1);
}

type Row = Record<string, string | number>;
const rows: Row[] = [];
const privateRows: Record<string, unknown>[] = [];
const byHash = new Map<string, string>();
const byNumber = new Map<string, string>();
const duplicates: string[] = [];
const tally: Record<string, number> = {};
const taxRates: Record<string, number> = {};
let lineTotal = 0;

for (const [i, name] of files.entries()) {
  const label = `U${String(i + 1).padStart(2, "0")}`;
  let doc;
  try {
    doc = await parseBiznisoftPdf(new Uint8Array(await readFile(path.join(dir, name))));
  } catch {
    rows.push({ ozn: label, status: "greska_citanja" });
    tally.greska_citanja = (tally.greska_citanja ?? 0) + 1;
    privateRows.push({ label, file: name, status: "greska_citanja" });
    continue;
  }
  tally[doc.validationStatus] = (tally[doc.validationStatus] ?? 0) + 1;
  lineTotal += doc.lines.length;

  const sameBytes = byHash.has(doc.fileHash);
  if (sameBytes) duplicates.push(`${label} = ${byHash.get(doc.fileHash)} (isti bajtovi)`);
  else byHash.set(doc.fileHash, label);
  const number = doc.header.documentNumber.value;
  if (number) {
    // Poređenje po otisku broja — sam broj se ne čuva u memoriji izveštaja.
    const key = createHash("sha256").update(`${doc.documentKind}|${number}`).digest("hex");
    const prev = byNumber.get(key);
    if (prev && !sameBytes) duplicates.push(`${label} ~ ${prev} (isti poslovni broj, drugi bajtovi)`);
    if (!prev) byNumber.set(key, label);
  }

  const lineStatus: Record<string, number> = {};
  let withDiscount = 0;
  for (const line of doc.lines) {
    const s = String(line.status).split(":")[0];
    lineStatus[s] = (lineStatus[s] ?? 0) + 1;
    if (typeof line.discountPercent === "number" && line.discountPercent !== 0) withDiscount++;
    if (typeof line.taxPercent === "number") taxRates[String(line.taxPercent)] = (taxRates[String(line.taxPercent)] ?? 0) + 1;
  }
  const pib = classifyPib(doc.header.customerPib.value).status;
  rows.push({
    ozn: label,
    str: doc.pageCount,
    vrsta: doc.documentKind,
    stavki: doc.lines.length,
    aritmetika: Object.entries(lineStatus).map(([k, v]) => `${k}:${v}`).join(" ") || "-",
    sRabatom: withDiscount,
    zbir: doc.totals.ok ? "ok" : String(doc.totals.reason ?? "-"),
    partner: doc.header.partnerCode.status,
    pib,
    datum: doc.header.documentDate.status,
    status: doc.validationStatus,
  });
  privateRows.push({ label, file: name, status: doc.validationStatus, detail: doc.validationDetail });
}

console.log(`dokumenata: ${files.length}`);
console.table(rows);
console.log("--- zbirno ---");
for (const [k, v] of Object.entries(tally)) console.log(`  ${k}: ${v}`);
console.log(`  stavki ukupno: ${lineTotal}`);
console.log(`  stope PDV-a (stavki po stopi): ${Object.entries(taxRates).map(([k, v]) => `${k}%:${v}`).join(", ") || "-"}`);
console.log(`  jedinstvenih otisaka: ${byHash.size} / ${files.length}`);
console.log(`  duplikati: ${duplicates.length ? "" : "nema"}`);
for (const d of duplicates) console.log(`    ${d}`);

if (report) {
  await writeFile(report, JSON.stringify({ folder: dir, generated: new Date().toISOString(), rows: privateRows }, null, 2), { mode: 0o600 });
  console.log("Privatni izveštaj (oznaka → fajl) upisan; putanja se ne ispisuje.");
}
