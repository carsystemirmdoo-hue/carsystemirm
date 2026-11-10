import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Alati komercijaliste (0061, 2026-11-10):
 *  - dugovanja iz tabele: snimak samo kada se sadržaj promeni, povezivanje po PIB-u/nazivu, opseg komercijaliste;
 *  - beleška razgovora se ne menja i ne briše; podsetnik se završava jednom, a nova beleška ga zatvara;
 *  - zahtev u ime kupca: „poslat“, sa pripremio = komercijalista; tuđ kupac se odbija.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);

const RUN = randomUUID().slice(0, 6);
const PIB_A = `9${RUN.replace(/[^0-9]/g, "7").padEnd(8, "1").slice(0, 8)}`;
const PIB_B = `8${RUN.replace(/[^0-9]/g, "3").padEnd(8, "2").slice(0, 8)}`;
const CODE = `QAL${RUN}`;
let db: TestDatabase;
const ids: Record<string, string> = {};
let custA = "";
let custB = "";

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const acc = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "milan", role: "komercijalista" },
  ]);
  for (const [k, v] of Object.entries(acc)) ids[k] = v.id;
  const [a] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${PIB_A}, ${`QA Lakirnica ${RUN} d.o.o.`}) RETURNING id`;
  const [b] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${PIB_B}, ${`QA Drugi ${RUN}`}) RETURNING id`;
  custA = a.id;
  custB = b.id;
  await db.sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${custA}, ${ids.milan})`;
  await db.sql`INSERT INTO articles (code, name, unit) VALUES (${CODE}, 'QA KLAR 1L', 'KOM')`;
  await db.sql`UPDATE users SET name = 'Milan QA' WHERE id = ${ids.milan}`;
});

after(async () => {
  if (!reason && db) {
    await db.sql`TRUNCATE receivable_sheet_customers, receivable_customer_links, receivable_lines, receivable_snapshots, customer_call_notes, customer_sales_contacts`;
    await db.sql`TRUNCATE customer_orders CASCADE`;
    await db.sql`DELETE FROM customer_assignments WHERE customer_id IN (${custA}, ${custB})`;
    await db.sql`DELETE FROM customers WHERE id IN (${custA}, ${custB})`;
    await db.sql`DELETE FROM articles WHERE code = ${CODE}`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const user = async (k: string) => (await (await import("@/lib/authz/user-repository")).loadPortalUser(ids[k]))!;

function csv(rows: string[][]) {
  return new TextEncoder().encode(rows.map((r) => r.join(";")).join("\n"));
}

test("dugovanja: snimak po promeni sadržaja, povezivanje po PIB-u i nazivu, opseg komercijaliste", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/sales-tools/receivables-service");
  const owner = await user("owner");
  const file = csv([
    ["Kupac", "PIB", "Broj fakture", "Datum", "Valuta", "Iznos", "Uplaćeno"],
    [`QA Lakirnica ${RUN} d.o.o.`, PIB_A, "F-1", "01.09.2026", "01.10.2026", "100.000,00", "40.000,00"],
    ["", "", "F-2", "15.10.2026", "14.12.2026", "20.000,00", ""],
    [`QA DRUGI ${RUN}`, "", "F-3", "01.10.2026", "31.10.2026", "5.000,00", ""],
    ["Nepoznat kupac", "", "F-4", "01.10.2026", "31.10.2026", "1.000,00", ""],
    ["Plaćen kupac", "", "F-5", "01.10.2026", "31.10.2026", "1.000,00", "1.000,00"],
  ]);
  const first = await svc.importReceivablesFile(owner, "proba.csv", file);
  assert.equal(first.changed, true);
  assert.equal(first.lines, 4);
  const again = await svc.importReceivablesFile(owner, "proba.csv", file);
  assert.equal(again.changed, false, "isti sadržaj ne pravi nov snimak");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM receivable_snapshots`;
  assert.equal(n, 1);

  const all = await svc.debtsByCustomer(owner, "2026-11-10");
  const a = all.find((d) => d.customerId === custA)!;
  assert.equal(a.total, 80000);
  assert.equal(a.overdueTotal, 60000);
  assert.equal(a.maxDaysOverdue, 40);
  assert.ok(all.some((d) => d.customerId === custB), "naziv bez „d.o.o.“ i velika slova se povezuju");
  const unmatched = await svc.unmatchedDebtLines();
  assert.deepEqual(unmatched.map((u) => u.label), ["Nepoznat kupac", "Plaćen kupac"], "prvo sa dugom, pa i kupci bez duga iz spiska");

  // Ručna veza: „Nepoznat kupac“ → kupac B; važi odmah, bez novog čitanja.
  await svc.linkSheetLabel(owner, { key: unmatched[0].key, customerId: custB });
  const b = (await svc.debtsByCustomer(owner, "2026-11-10")).find((d) => d.customerId === custB)!;
  assert.equal(b.total, 6000);
  assert.deepEqual((await svc.unmatchedDebtLines()).map((u) => u.label), ["Plaćen kupac"]);

  const mine = await svc.debtsByCustomer(await user("milan"), "2026-11-10");
  assert.deepEqual(mine.map((d) => d.customerId), [custA], "komercijalista vidi samo svoje kupce");

  await assert.rejects(db.sql`DELETE FROM receivable_lines`, /samo dodaju/);
  await assert.rejects(db.sql`DELETE FROM receivable_sheet_customers`, /samo dodaje/);
  await assert.rejects(db.sql`UPDATE receivable_snapshots SET row_count = 0`, /vreme provere/);
});

test("beleška razgovora: podsetnik, zatvaranje novom beleškom, zaštita od izmene", async (t) => {
  if (guard(t)) return;
  const desk = await import("@/lib/sales-tools/customer-desk-service");
  const milan = await user("milan");
  await desk.saveCustomerContact(milan, custA, { contactName: "Mika", phone: "063 111 2222" });
  await desk.addCallNote(milan, custA, { outcome: "javice_se", body: "zove u petak", followUpDays: 0 });
  await desk.addCallNote(milan, custA, { outcome: "javice_se", followUpOn: new Date().toISOString().slice(0, 10) });
  let d = await desk.loadCustomerDesk(milan, custA);
  assert.equal(d.phones[0]?.number, "063 111 2222");
  assert.equal(d.notes.length, 2);
  assert.ok(d.openFollowUp, "podsetnik za danas je otvoren");
  const due = await desk.dueFollowUps(milan);
  assert.equal(due.length, 1);
  await desk.addCallNote(milan, custA, { outcome: "porucio" });
  d = await desk.loadCustomerDesk(milan, custA);
  assert.equal(d.openFollowUp, null, "nova beleška zatvara otvoren podsetnik");
  await assert.rejects(desk.addCallNote(milan, custB, { outcome: "porucio" }), /opsegu/);
  await assert.rejects(desk.addCallNote(milan, custA, { outcome: "drugo" }), /Drugo/);
  await assert.rejects(db.sql`UPDATE customer_call_notes SET body = 'x'`, /ne menja/);
  await assert.rejects(db.sql`DELETE FROM customer_call_notes`, /ne briše/);
});

test("zahtev u ime kupca: poslat, pripremio komercijalista, isti ključ ne pravi drugi; tuđ kupac odbijen", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/ordering/request-service");
  const milan = await user("milan");
  const [art] = await db.sql<{ id: string }[]>`SELECT id FROM articles WHERE code = ${CODE}`;
  const key = randomUUID();
  const r = await svc.submitRepOrder(milan, custA, { idempotencyKey: key, lines: [{ articleId: art.id, quantity: 3 }], paymentOption: null, note: "preuzima u četvrtak" });
  assert.equal(r.existing, false);
  const [o] = await db.sql<{ status: string; prepared_by: string; submitted_by: string | null; customer_note: string }[]>`
    SELECT status::text, prepared_by, submitted_by, customer_note FROM customer_orders WHERE id = ${r.orderId}`;
  assert.deepEqual(o, { status: "submitted", prepared_by: ids.milan, submitted_by: null, customer_note: "preuzima u četvrtak" });
  const [ev] = await db.sql<{ reason: string }[]>`SELECT reason FROM customer_order_events WHERE order_id = ${r.orderId}`;
  assert.match(ev.reason, /po dogovoru sa kupcem/);
  const same = await svc.submitRepOrder(milan, custA, { idempotencyKey: key, lines: [{ articleId: art.id, quantity: 3 }], paymentOption: null });
  assert.equal(same.orderId, r.orderId);
  await assert.rejects(svc.submitRepOrder(milan, custB, { idempotencyKey: randomUUID(), lines: [{ articleId: art.id, quantity: 1 }], paymentOption: null }), /opsegu/);
  await assert.rejects(svc.submitRepOrder(milan, custA, { idempotencyKey: randomUUID(), lines: [{ articleId: art.id, quantity: 1.5 }], paymentOption: null }), svc.RepOrderError);
});

test("tabela komercijaliste: predlog dodele kada kupac nije dodeljen tom komercijalisti", async (t) => {
  if (guard(t)) return;
  const svc = await import("@/lib/sales-tools/receivables-service");
  const owner = await user("owner");
  // Tabela „Milan“ (naziv fajla) sadrži kupca B, koji u portalu nije Milanov.
  await svc.importReceivablesFile(owner, "Milan.csv", csv([
    ["naziv kupca", "faktura", "datum", "valuta", "iznos"],
    [`QA Drugi ${RUN}, BEOGRAD`, "Fak.9/2026", "01.10.2026", "31.10.2026", "1.000,00 din"],
    [`QA Lakirnica ${RUN} d.o.o., NOVI SAD`],
  ]));
  const s = await svc.sheetAssignmentSuggestions();
  assert.deepEqual(s.map((x) => [x.customerId, x.repId]), [[custB, ids.milan]], "A je već Milanov, B se predlaže");
});
