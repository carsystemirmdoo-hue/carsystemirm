import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Roba u dolasku (0064, 2026-11-12):
 *  - predlog našeg artikla po nazivu, pa zapamćena šifra dobavljača sledeći put;
 *  - prijem iz lagera: povećanje stanja posle porudžbine = stiglo (delimično, pa potpuno);
 *  - obrada istog snimka je ponovljiva bez dvostrukog brojanja;
 *  - nepovezana stavka se ne zatvara sama; otkazivanjem se porudžbina zatvara;
 *  - Nabavka vidi količinu u dolasku.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const CSV = readFileSync(new URL("../../fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.csv", import.meta.url));

/** Isti CSV sa drugim datumom stanja i drugom količinom artikla 900001. */
const csv = (date: string, qty: string) => {
  const text = new TextDecoder("windows-1250").decode(CSV);
  const out = text
    .replace(/(Na dan:;+)05\.09\.2026/, `$1${date}`)
    .replace(/^(900001;;;;;SINT BAZA SREBRNA 1 L;;;;;;;;;;;;20 %;;;;;;;)12;/m, `$1${qty};`);
  // Red 900001 mora postojati u fixture-u (inače bi se količina tiho ignorisala).
  assert.match(out, new RegExp(`^900001;;;;;SINT BAZA SREBRNA 1 L;;;;;;;;;;;;20 %;;;;;;;${qty.replace(".", "\\.")};`, "m"));
  return new TextEncoder().encode(out);
};

let db: TestDatabase;
type Acc = { id: string; name: string; role: string };
let owner: Acc;
let office: Acc;
const asUser = (a: Acc) => ({ id: a.id, email: `${a.id}@qa-dolazak.invalid`, name: a.name, initials: "QA", role: a.role as "gazda" | "kancelarija", active: true, sessionVersion: 0, permissions: [] as string[] });
const ids: Record<string, string> = {};

async function resetStock() {
  await db.sql`ALTER TABLE stock_import_lines DISABLE TRIGGER USER`;
  await db.sql`ALTER TABLE stock_imports DISABLE TRIGGER USER`;
  await db.sql`TRUNCATE stock_level_history, stock_import_lines, stock_imports, article_sellout`;
  await db.sql`ALTER TABLE stock_import_lines ENABLE TRIGGER USER`;
  await db.sql`ALTER TABLE stock_imports ENABLE TRIGGER USER`;
}

async function stock(date: string, qty: string) {
  const svc = await import("@/lib/stock/stock-import-service");
  const up = await svc.uploadStockReport(asUser(office), { fileName: `lager-${date}.csv`, bytes: csv(date, qty) });
  await svc.confirmStockImport(asUser(office), { importId: up.importId });
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "office", role: "kancelarija" }]);
  owner = acc.owner;
  office = acc.office;
  const rows = await db.sql<{ id: string; code: string }[]>`INSERT INTO articles (code, name, unit) VALUES
    ('900001', 'BASLAC BAZA SREBRNA METALIK 1L', 'LIT'), ('900002', 'BASLAC LAK HS 5L', 'KOM')
    RETURNING id, code`;
  for (const r of rows) ids[r.code] = r.id;
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM supplier_order_lines`;
    await db.sql`DELETE FROM supplier_orders`;
    await db.sql`DELETE FROM supplier_article_codes`;
    await resetStock();
    await db.sql`DELETE FROM articles WHERE id = ANY(${Object.values(ids)}::uuid[])`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("porudžbina: predlog po nazivu, zapamćena šifra, prijem iz lagera (delimično pa potpuno)", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/procurement/incoming-service");
  await stock("05.09.2026", "12");

  const [first] = await svc.proposeLines("Baslac", [{ row: 2, supplierCode: "BX-77", supplierName: "Baza srebrna metalik 1 L", quantity: 10, unit: "LIT" }]);
  assert.ok(first.candidates.some((c) => c.id === ids["900001"]), "kandidat po nazivu");

  const created = await svc.createSupplierOrder(asUser(owner), {
    supplier: "Baslac",
    reference: "AB-1",
    orderedOn: "2026-09-05",
    leadMin: 7,
    leadMax: 10,
    source: "excel",
    fileName: "potvrda.xlsx",
    note: null,
    lines: [
      { supplierCode: "BX-77", supplierName: "Baza srebrna metalik 1 L", quantity: 10, unit: "LIT", articleId: ids["900001"], remember: true },
      { supplierCode: "BX-99", supplierName: "Nepoznata stavka", quantity: 3, unit: "KOM", articleId: null, remember: false },
    ],
  });
  assert.equal(created.lines, 2);
  assert.equal(created.remembered, 1);

  // Sledeći put ista šifra dobavljača → zapamćen artikal.
  const [again] = await svc.proposeLines("Baslac", [{ row: 2, supplierCode: "BX-77", supplierName: "bilo šta", quantity: 1, unit: null }]);
  assert.equal(again.match?.how, "zapamceno");
  assert.equal(again.match?.id, ids["900001"]);

  const [base] = await db.sql<{ baseline: string }[]>`SELECT baseline_stock::text AS baseline FROM supplier_order_lines WHERE article_id = ${ids["900001"]}`;
  assert.equal(Number(base.baseline), 12);
  const inc = await svc.incomingByArticle();
  assert.equal(inc.get(ids["900001"])?.quantity, 10);
  assert.equal(inc.get(ids["900001"])?.nearest, "2026-09-15");

  // Nov lager: 12 → 18 = stiglo 6 od 10; isti snimak dvaput ne broji dvaput.
  await stock("06.09.2026", "18");
  await svc.settleArrivals();
  await svc.settleArrivals();
  let [l] = await db.sql<{ received: string; status: string }[]>`SELECT received::text, status FROM supplier_order_lines WHERE article_id = ${ids["900001"]}`;
  assert.equal(Number(l.received), 6);
  assert.equal(l.status, "ceka");

  // Prodato 3 (18 → 15), pa stiglo još (15 → 22): ukupno 10, stavka stigla.
  await stock("07.09.2026", "15");
  await svc.settleArrivals();
  await stock("08.09.2026", "22");
  await svc.settleArrivals();
  [l] = await db.sql<{ received: string; status: string }[]>`SELECT received::text, status FROM supplier_order_lines WHERE article_id = ${ids["900001"]}`;
  assert.equal(Number(l.received), 10);
  assert.equal(l.status, "stiglo");

  // Nepovezana stavka čeka; porudžbina je otvorena dok je vlasnik ne otkaže.
  let [o] = await db.sql<{ status: string }[]>`SELECT status FROM supplier_orders WHERE id = ${created.id}`;
  assert.equal(o.status, "otvoreno");
  const [unlinked] = await db.sql<{ id: string }[]>`SELECT id FROM supplier_order_lines WHERE article_id IS NULL`;
  await svc.changeLine(asUser(owner), { lineId: unlinked.id, action: "otkazano" });
  [o] = await db.sql<{ status: string }[]>`SELECT status FROM supplier_orders WHERE id = ${created.id}`;
  assert.equal(o.status, "zatvoreno");
  assert.equal((await svc.incomingByArticle()).size, 0);

  const view = await svc.loadIncoming({ now: new Date("2026-09-08T10:00:00Z") });
  const order = view.orders.find((x) => x.id === created.id)!;
  assert.equal(order.status, "zatvoreno");
  assert.equal(order.lines.length, 2);

  const [audit] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log WHERE entity_id = ${created.id}`;
  assert.ok(audit.n >= 2, "upis i izmena su u aktivnostima");
});

test("isti artikal u dve porudžbine: povećanje se ne broji dvaput", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/procurement/incoming-service");
  await resetStock();
  await stock("05.09.2026", "0");
  const mk = (ref: string) =>
    svc.createSupplierOrder(asUser(owner), {
      supplier: "Baslac", reference: ref, orderedOn: "2026-09-05", leadMin: 7, leadMax: 10, source: "rucno", fileName: null, note: null,
      lines: [{ supplierCode: null, supplierName: "Baza", quantity: 5, unit: "LIT", articleId: ids["900001"], remember: false }],
    });
  await mk("A");
  await mk("B");
  await stock("06.09.2026", "7");
  await svc.settleArrivals();
  const rows = await db.sql<{ reference: string; received: string; status: string }[]>`
    SELECT o.reference, l.received::text, l.status FROM supplier_order_lines l JOIN supplier_orders o ON o.id = l.order_id
     WHERE o.reference IN ('A', 'B') ORDER BY o.reference`;
  assert.deepEqual(rows.map((r) => [r.reference, Number(r.received), r.status]), [["A", 5, "stiglo"], ["B", 2, "ceka"]]);
});
