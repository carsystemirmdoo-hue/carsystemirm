/**
 * Uvoz starih storna i knjižnih odobrenja kao PDF (2026-11-12) — isti put kao ručni upload na
 * /portal/importi (`ingestBiznisoftPdf`), samo za fajlove koji nisu prošli kroz konektor.
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/sync/uvezi-pdf-dokumente.mts <pdf>... [--potvrdio <email> --upis]
 *
 * Bez `--upis` SAMO ČITA (sesija READ ONLY) i ispisuje šta bi se desilo: vrsta, broj, šifra
 * kupca, iznos, da li je kupac povezan i da li je isti fajl već uvezen. Sa `--upis` upisuje
 * kao zaposleni iz `--potvrdio` (trag u Aktivnostima). Prihvata samo storno i knjižno
 * odobrenje; fakturu odbija.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { sql } from "drizzle-orm";

const args = process.argv.slice(2);
const write = args.includes("--upis");
const byIdx = args.indexOf("--potvrdio");
const by = byIdx >= 0 ? args[byIdx + 1] : null;
const files = args.filter((a, i) => a.toLowerCase().endsWith(".pdf") && args[i - 1] !== "--potvrdio");
if (files.length === 0 || (write && !by)) {
  console.error("Upotreba: <pdf>... [--potvrdio <email> --upis]");
  process.exit(1);
}
process.env.DATABASE_POOL_MAX = "1";

const { getDb } = await import("@/db/client");
const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
const { normalizePartnerCode } = await import("@/lib/commercial/externalIdentity.mjs");
const db = getDb();
// Isti izdavalac kao uređaj KANC-01 i dosadašnji uvozi (pilot-decisions: CSRM).
const ISSUER = process.env.IMPORT_ISSUER_CODE ?? "CSRM";

if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
}
const [actor] = by
  ? [...(await db.execute<{ id: string; name: string; role: string }>(sql`
      SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))]
  : [];
if (write && !actor) {
  console.error(`Nema aktivnog zaposlenog ${by}.`);
  process.exit(1);
}

const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let errors = 0;
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(file));
  const p = await parseBiznisoftPdf(bytes);
  const name = basename(file);
  if (p.documentKind !== "storno" && p.documentKind !== "knjizno_odobrenje") {
    console.log(`✗ ${name}: vrsta „${p.documentKind}“ (${p.validationStatus}) — ovom skriptom idu samo storno i knjižno odobrenje.`);
    errors++;
    continue;
  }
  const gross = p.lines.reduce((s, l) => s + (l.grossAmount ?? 0), 0);
  const code = p.header.partnerCode.value;
  const partner = code ? normalizePartnerCode(code) : null;
  const [mapped] = partner
    ? [...(await db.execute<{ name: string }>(sql`
        SELECT c.name FROM customer_external_identifiers x JOIN customers c ON c.id = x.customer_id
         WHERE x.source_system = 'biznisoft' AND x.issuer_code = ${ISSUER}
           AND x.external_partner_code = ${partner} AND x.status = 'mapped' LIMIT 1`))]
    : [];
  const [dup] = [...(await db.execute<{ id: string }>(sql`SELECT id FROM source_documents WHERE file_hash = ${p.fileHash}`))];
  const ref = p.documentKind === "storno" ? ` poništava ${p.header.reversesDocumentNumber?.value ?? "?"}` : "";
  console.log(
    `${dup ? "=" : "•"} ${name}: ${p.documentKind} ${p.header.documentNumber.value ?? "?"} od ${p.header.documentDate.value ?? "?"}` +
      `, šifra ${code ?? "?"} (${mapped ? mapped.name : "kupac NIJE povezan"}), ${money(gross)} RSD${ref}, čitanje: ${p.validationStatus}` +
      (dup ? " — VEĆ UVEZEN" : ""),
  );
  if (!write || dup) continue;
  const out = await ingestBiznisoftPdf(
    { bytes, fileName: name, issuerCode: ISSUER },
    { id: actor.id, name: actor.name, role: actor.role as never },
  );
  console.log(`  → ${out.result}${"reversal" in out && out.reversal ? ` (storno: ${out.reversal})` : ""}`);
}
console.log(write ? "\nUpis završen." : "\nSamo čitanje — ništa nije upisano. Za upis: --potvrdio <email> --upis");
process.exit(errors ? 2 : 0);
