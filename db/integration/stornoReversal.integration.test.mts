import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Naknadno pristiglo storno (0033, docs/b2b/48): potpuno storno sa dokazanom
 * vezom isključuje original iz prometa, preporuka i pokazatelja kupovine —
 * bez brisanja ijednog dokumenta. Delimično, nesaglasno i nepovezano ide na
 * pregled; ponovljeno storno ne udvostručuje efekat; redosled dolaska nije bitan.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

const ISSUER = "QA-STORNO";
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
const kupci = new Map<string, string>();
const tag = randomUUID().slice(0, 6);

const r2 = (x: number) => Math.round(x * 100) / 100;
const fld = (v: unknown) => ({ raw: v === null ? null : String(v), value: v, status: v === null ? "missing" : "ok" });
type Line = ReturnType<typeof line>;
function line(n: number, code: string, quantity: number, unitPrice: number, discountPercent = 0) {
  const net = r2(quantity * unitPrice * (1 - discountPercent / 100));
  const tax = r2(net * 0.2);
  return { lineNumber: n, raw: "", articleCode: code, description: `QA ${code}`, unit: "KOM", quantity, unitPrice, discountPercent,
    taxPercent: 20, taxAmount: tax, grossAmount: r2(net + tax), status: "ok" };
}
const negate = (lines: Line[]) => lines.map((l) => ({ ...l, quantity: -l.quantity, taxAmount: -l.taxAmount, grossAmount: -l.grossAmount }));

function doc(o: { number: string; partner: string; date: string; lines: Line[]; kind?: "faktura" | "storno"; reverses?: string | null; reversesDate?: string | null; salt?: string }) {
  const kind = o.kind ?? "faktura";
  const gross = r2(o.lines.reduce((s, l) => s + l.grossAmount, 0));
  return {
    fileHash: createHash("sha256").update(`${o.number}|${kind}|${o.salt ?? ""}|${tag}`).digest("hex"),
    pageCount: 1,
    parserVersion: "biznisoft-pdf-2",
    documentKind: kind,
    validationStatus: kind === "faktura" ? "valid" : "unsupported_requires_sample",
    validationDetail: kind === "storno" ? "Storno: dokument poništava raniji račun." : null,
    header: {
      documentNumber: fld(o.number), partnerCode: fld(o.partner), documentDate: fld(o.date), printedGrossTotal: fld(gross),
      customerPib: fld("100000001"), reversesDocumentNumber: fld(o.reverses ?? null), reversesDocumentDate: fld(o.reversesDate ?? null),
      issuerPib: fld("100000002"), isBiznisoft: fld(true),
    },
    lines: o.lines,
    totals: { ok: true, computed: gross, printed: gross },
  } as never;
}

async function ingest(d: never) {
  const { ingestParsedDocument } = await import("@/lib/pdf/ingest");
  return ingestParsedDocument(d, { fileName: "qa.pdf", issuerCode: ISSUER }, owner) as Promise<Record<string, unknown>>;
}
const num = (n: number) => `${tag.slice(0, 2).replace(/\D/g, "9")}-RN021${String(n).padStart(6, "0")}`;
async function ledger(number: string) {
  const [x] = await db.sql<{ n: number; net: string }[]>`
    SELECT count(*)::int AS n, coalesce(sum(e.line_amount), 0)::text AS net FROM effective_sales_ledger e
      JOIN invoices i ON i.id = e.invoice_id WHERE i.company_id = ${ISSUER} AND i.number = ${number}`;
  const [y] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM recommendation_input_lines r JOIN invoices i ON i.id = r.invoice_id
     WHERE i.company_id = ${ISSUER} AND i.number = ${number}`;
  return { ledgerLines: x.n, ledgerNet: Number(x.net), inputLines: y.n };
}
const reversalsFor = (original: string) =>
  db.sql<{ status: string; comparison: string | null; reasons: string[]; net_effect: string | null; gross_effect: string | null }[]>`
    SELECT status::text, comparison, reasons, net_effect::text, gross_effect::text FROM invoice_reversals
     WHERE issuer_code = ${ISSUER} AND original_number = ${original} ORDER BY created_at`;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: accounts.owner.id, name: accounts.owner.name, role: accounts.owner.role };
  for (const p of ["00901", "00902"]) {
    const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QS${tag}${p}`}, ${`QA storno ${p}`}) RETURNING id`;
    kupci.set(p, c.id);
    await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
                 VALUES ('biznisoft', ${ISSUER}, ${p}, ${c.id}, 'mapped')`;
  }
});

after(async () => {
  if (!reason && db) {
    await db.sql.begin(async (tx) => {
      // Zapis storna se namerno ne može obrisati; čišćenje test baze isključuje okidače samo u ovoj transakciji.
      await tx`SET LOCAL session_replication_role = replica`;
      await tx`DELETE FROM invoice_reversals WHERE issuer_code = ${ISSUER}`;
      await tx`DELETE FROM source_document_lines WHERE source_document_id IN (SELECT id FROM source_documents WHERE issuer_code = ${ISSUER})`;
      await tx`UPDATE source_documents SET invoice_id = NULL WHERE issuer_code = ${ISSUER}`;
      await tx`DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${ISSUER})`;
      await tx`DELETE FROM invoices WHERE company_id = ${ISSUER}`;
      await tx`DELETE FROM source_documents WHERE issuer_code = ${ISSUER}`;
      await tx`DELETE FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
      await tx`DELETE FROM customers WHERE id IN ${tx([...kupci.values()])}`;
      // Prijem sam upisuje nepoznate šifre u registar artikala.
      await tx`DELETE FROM articles WHERE code IN ${tx(BASE.map((l) => l.articleCode))}
                 AND NOT EXISTS (SELECT 1 FROM invoice_lines il WHERE il.article_id = articles.id)`;
    });
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const BASE = [line(1, "QA-S01", 2, 1000, 10), line(2, "QA-S02", 3, 250, 5), line(3, "QA-S03", 4, 75)];

test("original pa potpuno storno: original van prometa i preporuka, dokumenti ostaju, trag postoji", async (t) => {
  if (guard(t)) return;
  const o = num(101), s = num(102);
  assert.equal((await ingest(doc({ number: o, partner: "00901", date: "2026-08-18", lines: BASE }))).result, "ingested");
  const pre = await ledger(o);
  assert.equal(pre.ledgerLines, 3);
  assert.equal(pre.inputLines, 3);
  const [inv] = await db.sql<{ id: string; net: string; gross: string }[]>`
    SELECT id, net_amount::text AS net, total_amount::text AS gross FROM invoices WHERE company_id = ${ISSUER} AND number = ${o}`;

  const out = await ingest(doc({ number: s, partner: "00901", date: "2026-08-18", kind: "storno", lines: negate(BASE), reverses: o, reversesDate: "2026-08-18" }));
  assert.equal(out.result, "quarantined");
  assert.equal(out.reversal, "applied");

  const posle = await ledger(o);
  assert.deepEqual([posle.ledgerLines, posle.inputLines], [0, 0], "original i dalje u prometu/preporukama");
  const [r] = await reversalsFor(o);
  assert.equal(r.status, "applied");
  assert.equal(r.comparison, "full");
  assert.equal(r.net_effect, inv.net, "uklonjeni neto = neto originala");
  assert.equal(r.gross_effect, inv.gross, "uklonjeni bruto = bruto originala");

  // Ništa nije obrisano: faktura, stavke i oba izvorna dokumenta postoje.
  const [{ fakt, stavki, dok }] = await db.sql<{ fakt: number; stavki: number; dok: number }[]>`
    SELECT (SELECT count(*)::int FROM invoices WHERE id = ${inv.id}) AS fakt,
           (SELECT count(*)::int FROM invoice_lines WHERE invoice_id = ${inv.id}) AS stavki,
           (SELECT count(*)::int FROM source_documents WHERE issuer_code = ${ISSUER} AND business_document_number IN (${o}, ${s})) AS dok`;
  assert.deepEqual([fakt, stavki, dok], [1, 3, 2]);
  const [sd] = await db.sql<{ manual_review: string; validation_status: string }[]>`
    SELECT manual_review::text, validation_status::text FROM source_documents WHERE issuer_code = ${ISSUER} AND business_document_number = ${s}`;
  assert.deepEqual([sd.manual_review, sd.validation_status], ["resolved", "unsupported_requires_sample"]);
  const [{ trag }] = await db.sql<{ trag: number }[]>`
    SELECT count(*)::int AS trag FROM audit_log WHERE action = 'Storno primenjen — original isključen iz prometa' AND actor_user_id = ${owner.id}`;
  assert.ok(trag >= 1);

  // Pokazatelji kupovine (kartica kupca) ne broje stornirani original; istorija ga prikazuje sa oznakom.
  const { loadCustomerOverview, loadCustomerInvoices } = await import("@/lib/customers/customer-queries");
  const ov = await loadCustomerOverview(kupci.get("00901")!);
  assert.equal(ov?.invoices, 0);
  assert.equal(ov?.lastIssuedOn, null);
  const lista = await loadCustomerInvoices(kupci.get("00901")!, { page: 1 });
  assert.equal(lista.rows.find((x) => x.number === o)?.reversed, true);
});

test("ponovljeno slanje istog storna ne udvostručuje efekat; drugi fajl istog storna ide na pregled", async (t) => {
  if (guard(t)) return;
  const o = num(101), s = num(102);
  const isti = await ingest(doc({ number: s, partner: "00901", date: "2026-08-18", kind: "storno", lines: negate(BASE), reverses: o, reversesDate: "2026-08-18" }));
  assert.equal(isti.result, "duplicate_file");
  const drugi = await ingest(doc({ number: s, partner: "00901", date: "2026-08-18", kind: "storno", lines: negate(BASE), reverses: o, reversesDate: "2026-08-18", salt: "ponovo odstampano" }));
  assert.equal(drugi.reversal, "review");
  const rs = await reversalsFor(o);
  assert.equal(rs.filter((r) => r.status === "applied").length, 1);
  assert.ok(rs.some((r) => r.status === "review" && r.reasons.includes("original_already_reversed")));
  assert.equal((await ledger(o)).ledgerLines, 0);
});

test("storno pa original: storno čeka, primenjuje se pri knjiženju originala", async (t) => {
  if (guard(t)) return;
  const o = num(2001), s = num(2002);
  const st = await ingest(doc({ number: s, partner: "00902", date: "2026-09-02", kind: "storno", lines: negate(BASE), reverses: o, reversesDate: "2026-09-01" }));
  assert.equal(st.reversal, "waiting_original");
  const [sd] = await db.sql<{ manual_review: string }[]>`SELECT manual_review::text FROM source_documents WHERE issuer_code = ${ISSUER} AND business_document_number = ${s}`;
  assert.equal(sd.manual_review, "pending");
  assert.equal((await ingest(doc({ number: o, partner: "00902", date: "2026-09-01", lines: BASE }))).result, "ingested");
  assert.equal((await reversalsFor(o))[0].status, "applied");
  const posle = await ledger(o);
  assert.deepEqual([posle.ledgerLines, posle.inputLines], [0, 0]);
});

test("delimično storno ne isključuje original — ide na pregled", async (t) => {
  if (guard(t)) return;
  const o = num(3001), s = num(3002);
  await ingest(doc({ number: o, partner: "00901", date: "2026-09-03", lines: BASE }));
  const pre = await ledger(o);
  const out = await ingest(doc({ number: s, partner: "00901", date: "2026-09-03", kind: "storno", lines: negate(BASE.slice(0, 1)), reverses: o, reversesDate: "2026-09-03" }));
  assert.equal(out.reversal, "review");
  const [r] = await reversalsFor(o);
  assert.equal(r.comparison, "partial");
  assert.deepEqual(await ledger(o), pre, "delimično storno je promenilo promet originala");
  assert.equal(pre.ledgerLines, 3);
});

test("nesaglasno (drugi kupac ili drugi datum originala) ide na pregled; original ostaje", async (t) => {
  if (guard(t)) return;
  const o = num(4001);
  await ingest(doc({ number: o, partner: "00901", date: "2026-09-04", lines: BASE }));
  const kupac = await ingest(doc({ number: num(4002), partner: "00902", date: "2026-09-04", kind: "storno", lines: negate(BASE), reverses: o, reversesDate: "2026-09-04" }));
  const datum = await ingest(doc({ number: num(4003), partner: "00901", date: "2026-09-04", kind: "storno", lines: negate(BASE), reverses: o, reversesDate: "2026-09-05" }));
  assert.deepEqual([kupac.reversal, datum.reversal], ["review", "review"]);
  const rs = await reversalsFor(o);
  assert.ok(rs[0].reasons.includes("partner_differs"));
  assert.ok(rs[1].reasons.includes("original_date_differs"));
  assert.equal((await ledger(o)).ledgerLines, 3);
});

test("storno bez odštampane reference ne pravi vezu; drugi račun istog kupca se ne dira", async (t) => {
  if (guard(t)) return;
  const sledeci = num(5002);
  await ingest(doc({ number: sledeci, partner: "00901", date: "2026-08-19", lines: BASE.slice(0, 2) }));
  const out = await ingest(doc({ number: num(5001), partner: "00901", date: "2026-08-18", kind: "storno", lines: negate(BASE) }));
  assert.equal(out.result, "quarantined");
  assert.equal(out.reversal, undefined);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoice_reversals WHERE issuer_code = ${ISSUER} AND original_number = ${sledeci}`;
  assert.equal(n, 0);
  assert.equal((await ledger(sledeci)).ledgerLines, 2);
});

test("zapis storna se ne briše i referenca se ne menja", async (t) => {
  if (guard(t)) return;
  const [r] = await db.sql<{ id: string }[]>`SELECT id FROM invoice_reversals WHERE issuer_code = ${ISSUER} LIMIT 1`;
  await assert.rejects(db.sql`DELETE FROM invoice_reversals WHERE id = ${r.id}`, /ne brišu/);
  await assert.rejects(db.sql`UPDATE invoice_reversals SET original_number = 'X' WHERE id = ${r.id}`, /ne menja/);
});
