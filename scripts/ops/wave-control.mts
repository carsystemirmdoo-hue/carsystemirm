/**
 * Kontrola talasa istorijskih faktura — SAMO ČITANJE baze i fajlova.
 *
 *   DATABASE_URL=<pilot, carsystem_app> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/ops/wave-control.mts pre  --talas ~/.carsystem-private/talas-01-2025-01.json --izdavalac CSRM
 *
 *   DATABASE_URL=… npx tsx … wave-control.mts posle --talas … --izdavalac CSRM \
 *     [--bs-broj N --bs-neto X --bs-pdv Y --bs-bruto Z]
 *
 * Ispisuje samo nazive provera, ✔/✖ i kratko objašnjenje (brojeve dokumenata,
 * ne iznose). `pre` beleži veličinu baze u privatni fajl da bi `posle` prikazao
 * promenu. Izlazni kod 1 ako ijedna provera padne.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { postImportChecks, preImportChecks } from "../../lib/import/waveControl.mjs";
import { PARSER_VERSION } from "../../lib/pdf/biznisoftLayout.mjs";

const [mode, ...rest] = process.argv.slice(2);
const arg = (n: string) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const expand = (p: string) => p.replace(/^~/, homedir());
const need = (n: string) => { const v = arg(n); if (!v) throw new Error(`Nedostaje --${n}.`); return v; };

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Postavite DATABASE_URL ciljne baze (runtime uloga).");
  const manifestPath = expand(need("talas"));
  const issuer = need("izdavalac");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const hashes: string[] = manifest.dokumenti.map((d: { sha256: string }) => d.sha256);
  const statePath = path.join(path.dirname(manifestPath), `${path.basename(manifestPath, ".json")}-kontrola-pre.json`);

  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  await sql`SET default_transaction_read_only = on`;
  const [{ size }] = await sql<{ size: string }[]>`SELECT pg_database_size(current_database())::text AS size`;
  const sizeBytes = Number(size);

  let checks;
  if (mode === "pre") {
    const files = manifest.dokumenti.map((d: { fajl: string; sha256: string }) => {
      const present = existsSync(d.fajl);
      return { sha256: d.sha256, present, actualSha: present ? createHash("sha256").update(readFileSync(d.fajl)).digest("hex") : null };
    });
    const [{ demo }] = await sql<{ demo: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM system_settings WHERE key = 'dataset.kind' AND value->>'kind' = 'demo') AS demo`;
    const [{ imported }] = await sql<{ imported: number }[]>`
      SELECT count(*)::int AS imported FROM source_documents WHERE file_hash IN ${sql(hashes)}`;
    const codes: string[] = [...new Set<string>(manifest.dokumenti.map((d: { sifra_partnera: string }) => d.sifra_partnera))];
    const mapped = await sql<{ code: string }[]>`
      SELECT external_partner_code AS code FROM customer_external_identifiers
       WHERE source_system = 'biznisoft' AND issuer_code = ${issuer} AND status = 'mapped'
         AND customer_id IS NOT NULL AND external_partner_code IN ${sql(codes)}`;
    const mappedSet = new Set(mapped.map((m) => m.code));
    const [{ pending }] = await sql<{ pending: number }[]>`
      SELECT count(*)::int AS pending FROM source_documents WHERE issuer_code = ${issuer} AND manual_review = 'pending'`;
    checks = preImportChecks({
      manifest, files, repoParserVersion: PARSER_VERSION,
      db: { demoMarker: demo, sizeBytes, alreadyImported: imported, unmappedPartnerCodes: codes.filter((c) => !mappedSet.has(c)), pendingReview: pending },
    });
    writeFileSync(statePath, JSON.stringify({ sizeBytes, at: new Date().toISOString() }), { mode: 0o600 });
  } else if (mode === "posle") {
    const docs = await sql<{ sha256: string; valid: boolean; invoiceId: string | null; manualReview: string; revisionStatus: string }[]>`
      SELECT file_hash AS sha256, validation_status = 'valid' AS valid, invoice_id AS "invoiceId",
             manual_review::text AS "manualReview", revision_status::text AS "revisionStatus"
        FROM source_documents WHERE file_hash IN ${sql(hashes)}`;
    const ids = docs.map((d) => d.invoiceId).filter((x): x is string => Boolean(x));
    const [inv] = ids.length
      ? await sql<{ count: number; lines: number; net: string; gross: string }[]>`
          SELECT count(*)::int AS count,
                 (SELECT count(*)::int FROM invoice_lines WHERE invoice_id IN ${sql(ids)}) AS lines,
                 coalesce(sum(net_amount), 0)::text AS net, coalesce(sum(total_amount), 0)::text AS gross
            FROM invoices WHERE id IN ${sql(ids)}`
      : [{ count: 0, lines: 0, net: "0", gross: "0" }];
    const month: string = manifest.talas; // „2025-01"
    const [{ inPeriod }] = await sql<{ inPeriod: number }[]>`
      SELECT count(*)::int AS "inPeriod" FROM invoices
       WHERE company_id = ${issuer} AND document_kind = 'faktura'
         AND issued_on >= ${`${month}-01`}::date AND issued_on < (${`${month}-01`}::date + interval '1 month')`;
    const before = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")).sizeBytes : null;
    const bs = arg("bs-broj")
      ? { broj: Number(arg("bs-broj")), neto: Number(arg("bs-neto")), pdv: Number(arg("bs-pdv")), bruto: Number(arg("bs-bruto")) }
      : null;
    checks = postImportChecks({
      manifest,
      db: { documents: docs, invoices: { count: inv.count, lines: inv.lines, net: Number(inv.net), gross: Number(inv.gross) },
        invoicesInPeriodForIssuer: inPeriod, sizeBytesBefore: before, sizeBytesAfter: sizeBytes },
      bizniSoft: bs,
    });
  } else {
    await sql.end();
    throw new Error("Upotreba: wave-control.mts pre|posle --talas … --izdavalac …");
  }
  await sql.end();
  for (const c of checks) console.log(`  ${c.ok ? "✔" : "✖"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(failed ? `\nNE PROLAZI: ${failed} provera.` : "\nSve provere prolaze.");
  process.exitCode = failed ? 1 : 0;
}

main().catch((e: unknown) => { console.error((e as Error).message); process.exit(1); });
