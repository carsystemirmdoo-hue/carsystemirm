/**
 * Provera stvarnih BizniSoft PDF faktura BEZ UPISA — pre prvog uvoza.
 *
 *   BIZNISOFT_SAMPLES=/privatni/folder [BIZNISOFT_PREFIX=Fak] \
 *   [BIZNISOFT_RECURSIVE=1] [BIZNISOFT_HOLDOUT_MANIFEST=… [BIZNISOFT_HOLDOUT_MODE=samo]]
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
import { getDocumentProxy } from "unpdf";
import { parseBiznisoftPdf } from "../../lib/pdf/extract.ts";
import { compareStornoToOriginal } from "../../lib/pdf/storno.mjs";
import { classifyPib } from "../../lib/partners/pib.mjs";

const expand = (p: string) => p.replace(/^~/, homedir());
if (!process.env.BIZNISOFT_SAMPLES) {
  console.error("Postavite BIZNISOFT_SAMPLES na privatni folder sa fakturama. Podrazumevane putanje nema.");
  process.exit(1);
}
// Više foldera razdvojenih sa „:" (npr. po godinama) — duplikati se traže preko svih.
const dirs = process.env.BIZNISOFT_SAMPLES.split(path.delimiter).filter(Boolean).map(expand);
const dir = dirs.length === 1 ? dirs[0] : path.dirname(dirs[0]);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const report = process.env.BIZNISOFT_PRIVATE_REPORT ? expand(process.env.BIZNISOFT_PRIVATE_REPORT) : null;
if (report && path.resolve(report).startsWith(repoRoot + path.sep)) {
  console.error("Privatni izveštaj ne sme biti unutar repozitorijuma.");
  process.exit(1);
}

const prefix = process.env.BIZNISOFT_PREFIX ?? "";
const recursive = process.env.BIZNISOFT_RECURSIVE === "1";

/** PDF-ovi u folderu (i potfolderima uz BIZNISOFT_RECURSIVE=1); simbolične veze se preskaču. */
async function collect(root: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory() && recursive) found.push(...(await collect(full)));
    else if (entry.isFile() && /\.pdf$/i.test(entry.name) && entry.name.startsWith(prefix)) found.push(full);
  }
  return found;
}
const allFiles = (await Promise.all(dirs.map(collect))).flat().sort();

/*
 * Nezavisan završni uzorak (manifest sa putanjama i SHA-256 otiscima, izabran
 * PRE čitanja sadržaja). Podrazumevano se njegovi fajlovi PRESKAČU pre
 * parsiranja — i po putanji i po otisku, da ni kopija pod drugim imenom ne
 * uđe u podešavanje. `BIZNISOFT_HOLDOUT_MODE=samo` je jednokratni završni prolaz.
 */
const holdoutPath = process.env.BIZNISOFT_HOLDOUT_MANIFEST ? expand(process.env.BIZNISOFT_HOLDOUT_MANIFEST) : null;
const holdoutMode = process.env.BIZNISOFT_HOLDOUT_MODE === "samo" ? "samo" : "izuzmi";
let files = allFiles;
let heldOut = 0;
if (holdoutPath) {
  const manifest = JSON.parse(await readFile(holdoutPath, "utf8")) as { fajlovi: { putanja: string; sha256: string }[] };
  const desktop = path.join(homedir(), "Desktop");
  const paths = new Set(manifest.fajlovi.map((f) => path.join(desktop, f.putanja)));
  const hashes = new Set(manifest.fajlovi.map((f) => f.sha256));
  const keep: string[] = [];
  for (const file of allFiles) {
    const inHoldout = paths.has(file) || hashes.has(createHash("sha256").update(await readFile(file)).digest("hex"));
    if (inHoldout) heldOut++;
    if (inHoldout === (holdoutMode === "samo")) keep.push(file);
  }
  files = keep;
}
if (files.length === 0) {
  console.error("Nema PDF-ova u zadatom folderu.");
  process.exit(1);
}

type Row = Record<string, string | number>;
const rows: Row[] = [];
const privateRows: Record<string, unknown>[] = [];
const byHash = new Map<string, string>();
const byNumber = new Map<string, string>();
const duplicates: { a: string; b: string; kind: "isti_bajtovi" | "isti_poslovni_broj" }[] = [];
const count = (bucket: Record<string, number>, key: string) => { bucket[key] = (bucket[key] ?? 0) + 1; };
const tally: Record<string, number> = {};
const kinds: Record<string, number> = {};
const totals: Record<string, number> = {};
const docsWithLineIssue: Record<string, number> = {};
const lineStatusAll: Record<string, number> = {};
const partner: Record<string, number> = {};
const pibs: Record<string, number> = {};
const dates: Record<string, number> = {};
const taxRates: Record<string, number> = {};
let lineTotal = 0;
const docsForSummary: { label: string; year: string; layout: string; fak: boolean; status: string; kind: string;
  number: string | null; reverses: string | null; view: Parameters<typeof compareStornoToOriginal>[0] }[] = [];
let linesWithDiscount = 0;
const width = String(files.length).length;

for (const [i, file] of files.entries()) {
  const label = `U${String(i + 1).padStart(width, "0")}`;
  const root = dirs.find((d) => file.startsWith(d + path.sep)) ?? dir;
  const rel = path.join(path.basename(root), path.relative(root, file));
  let doc;
  try {
    doc = await parseBiznisoftPdf(new Uint8Array(await readFile(file)));
  } catch (error) {
    count(tally, "greska_citanja");
    rows.push({ ozn: label, status: "greska_citanja" });
    privateRows.push({ label, file: rel, absolute: file, status: "greska_citanja", error: (error as Error).message });
    continue;
  }
  count(tally, doc.validationStatus);
  count(kinds, doc.documentKind);
  count(totals, doc.totals.ok ? "ok" : String(doc.totals.reason ?? "-"));
  lineTotal += doc.lines.length;

  const sameBytes = byHash.has(doc.fileHash);
  if (sameBytes) duplicates.push({ a: label, b: byHash.get(doc.fileHash)!, kind: "isti_bajtovi" });
  else byHash.set(doc.fileHash, label);
  const number = doc.header.documentNumber.value;
  if (number) {
    const key = createHash("sha256").update(`${doc.documentKind}|${number}`).digest("hex");
    const prev = byNumber.get(key);
    if (prev && !sameBytes) duplicates.push({ a: label, b: prev, kind: "isti_poslovni_broj" });
    if (!prev) byNumber.set(key, label);
  }

  const lineStatus: Record<string, number> = {};
  let withDiscount = 0;
  for (const line of doc.lines) {
    const s = String(line.status).split(":")[0];
    count(lineStatus, s);
    count(lineStatusAll, s);
    if (typeof line.discountPercent === "number" && line.discountPercent !== 0) withDiscount++;
    if (typeof line.taxPercent === "number") count(taxRates, String(line.taxPercent));
  }
  linesWithDiscount += withDiscount;
  for (const s of Object.keys(lineStatus)) if (s !== "ok") count(docsWithLineIssue, s);
  const pib = classifyPib(doc.header.customerPib.value).status;
  count(partner, doc.header.partnerCode.status);
  count(pibs, pib);
  count(dates, doc.header.documentDate.status);
  const row = {
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
  };
  rows.push(row);
  // Raspored: zaglavlje tabele sa kolonom „Barkod" ili bez nje.
  const firstPage = await (await getDocumentProxy(new Uint8Array(await readFile(file)))).getPage(1);
  const layout = (await firstPage.getTextContent()).items.some((it) => "str" in it && it.str.trim() === "Barkod")
    ? "sa_barkodom" : "bez_barkoda";
  const year = String(doc.header.documentDate.value ?? "").slice(0, 4) || "bez_datuma";
  const fak = /^fak/i.test(path.basename(file));
  docsForSummary.push({ label, year, layout, fak, status: doc.validationStatus, kind: doc.documentKind,
    number, reverses: doc.header.reversesDocumentNumber.value,
    view: { partnerCode: doc.header.partnerCode.value, total: doc.header.printedGrossTotal.value ?? doc.totals.computed ?? null,
      lines: doc.lines.map((l) => ({ articleCode: l.articleCode, quantity: l.quantity, unitPrice: l.unitPrice, discountPercent: l.discountPercent })) } });
  privateRows.push({ layout, year, fak, reversesDocumentNumber: doc.header.reversesDocumentNumber.value,
    ...row, file: rel, absolute: file, detail: doc.validationDetail,
    documentNumber: number, partnerCode: doc.header.partnerCode.value, documentDate: doc.header.documentDate.value,
  });
}

const show = (title: string, bucket: Record<string, number>) =>
  console.log(`  ${title}: ${Object.entries(bucket).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "-"}`);

console.log(`PDF fajlova: ${files.length}` + (holdoutPath
  ? (holdoutMode === "samo" ? " (SAMO završni uzorak)" : ` (završni uzorak izuzet pre čitanja: ${heldOut})`)
  : ""));
// Tabela po dokumentu samo za mali skup; za veliki ide u privatni izveštaj.
if (files.length <= 50) console.table(rows);
console.log("--- zbirno ---");
show("status", tally);
show("vrsta dokumenta", kinds);
show("zbir prema odštampanom", totals);
show("dokumenata sa problemom u stavkama", docsWithLineIssue);
show("stavke po statusu", lineStatusAll);
show("šifra partnera", partner);
show("PIB kupca", pibs);
show("datum", dates);
console.log(`  stavki ukupno: ${lineTotal} · sa rabatom: ${linesWithDiscount}`);
console.log(`  stope PDV-a (stavki po stopi): ${Object.entries(taxRates).map(([k, v]) => `${k}%:${v}`).join(", ") || "-"}`);
console.log(`  jedinstvenih otisaka: ${byHash.size} / ${files.length}`);
const dupByKind: Record<string, number> = {};
for (const d of duplicates) count(dupByKind, d.kind);
show("duplikati", dupByKind);
for (const d of duplicates.slice(0, 20)) console.log(`    ${d.a} ↔ ${d.b} (${d.kind})`);
if (duplicates.length > 20) console.log(`    … još ${duplicates.length - 20} u privatnom izveštaju`);

// Naziv „Fak" je pomoć pri izboru, ne dokaz — poredi se sa sadržajem.
const fakVsContent: Record<string, number> = {};
for (const d of docsForSummary) {
  const content = d.kind === "storno" ? "storno" : d.status === "valid" ? "prodajna_faktura" : "drugo";
  count(fakVsContent, `${d.fak ? "Fak" : "bez Fak"} → ${content}`);
}
show("naziv fajla prema sadržaju", fakVsContent);

// Storna: veza sa originalom i obim poništenja.
const byNum = new Map(docsForSummary.filter((d) => d.status === "valid").map((d) => [d.number, d]));
const storna = docsForSummary.filter((d) => d.kind === "storno");
const stornoKinds: Record<string, number> = {};
const cancelledOriginals = new Set<string>();
const stornoPrivate: { storno: string; original: string | null; ishod: string; razlozi: string[] }[] = [];
for (const s of storna) {
  const orig = s.reverses ? byNum.get(s.reverses) : undefined;
  if (!orig) { count(stornoKinds, "original_nije_u_skupu"); stornoPrivate.push({ storno: s.label, original: null, ishod: "original_nije_u_skupu", razlozi: [] }); continue; }
  const r = compareStornoToOriginal(s.view, orig.view);
  count(stornoKinds, r.kind);
  cancelledOriginals.add(orig.label);
  stornoPrivate.push({ storno: s.label, original: orig.label, ishod: r.kind, razlozi: r.reasons });
}
console.log(`  storna: ${storna.length}`);
show("storno prema originalu", stornoKinds);
if (storna.length > 0) {
  console.log(`  UPOZORENJE: ${cancelledOriginals.size} ispravnih faktura je stornirano; dok uvoz storna nije podržan,`);
  console.log("  promet, količine i preporuke izračunati bez storna NISU konačni.");
}

// Po godinama i rasporedima.
const byYearLayout: Record<string, Record<string, number>> = {};
for (const d of docsForSummary) {
  const k = `${d.year} · ${d.layout}`;
  byYearLayout[k] ??= {};
  count(byYearLayout[k], d.kind === "storno" ? "storno" : d.status);
}
console.log("  po godini i rasporedu:");
for (const k of Object.keys(byYearLayout).sort()) show(`    ${k}`, byYearLayout[k]);

if (report) {
  await writeFile(
    report,
    JSON.stringify({ folder: dir, generated: new Date().toISOString(), duplicates, storna: stornoPrivate,
      stornirani_originali: [...cancelledOriginals], rows: privateRows }, null, 2),
    { mode: 0o600 },
  );
  console.log("Privatni izveštaj (oznaka → fajl i podaci dokumenta) upisan; putanja se ne ispisuje.");
}
