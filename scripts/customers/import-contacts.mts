/**
 * Uvoz kontakata kupaca (telefon, e-pošta, kontakt osoba) u „Kontakt kupca“ na kartici kupca
 * (customer_sales_contacts) — 2026-11-14, iz BizniSoft liste partnera i pretrage interneta.
 *
 *   scripts/customers/import-contacts.mts <plan.json> [--potvrdio <email> --upis [--production-odobreno]]
 *
 * plan.json: { izvor, kontakti: [{ kupac_id, sifra, naziv, email, telefon, kontakt, napomena }] }
 *
 * Bez `--upis` SAMO ČITA (sesija READ ONLY) i ispisuje šta bi se upisalo.
 * Postojeći kontakt kupca se NE GAZI (ručno upisano na kartici ima prednost); takav kupac se preskače.
 * Isto pravilo provere kao obrazac na kartici (parseContact). Jedan zapis u dnevniku aktivnosti.
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const [planPath, ...rest] = process.argv.slice(2);
const arg = (n: string) => {
  const i = rest.indexOf(n);
  return i >= 0 ? rest[i + 1] : undefined;
};
const write = rest.includes("--upis");
const by = arg("--potvrdio");
if (!planPath || (write && !by)) {
  console.error("Upotreba: <plan.json> [--potvrdio <email> --upis]");
  process.exit(1);
}
if (write && /neon\.tech|neon\.build/.test(process.env.DATABASE_URL ?? "") && !rest.includes("--production-odobreno")) {
  console.error("Production baza: upis traži posebno odobrenje vlasnika (--production-odobreno). Prekinuto.");
  process.exit(1);
}
if (!write) process.env.DATABASE_POOL_MAX = "1";

const { getDb } = await import("@/db/client");
const { parseContact } = await import("@/lib/sales-tools/customerDesk.mjs");
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");

type Row = { kupac_id: string; sifra: string; naziv: string; email: string | null; telefon: string | null; kontakt: string | null; napomena: string | null };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor: string; kontakti: Row[] };
const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") {
    console.error("Sesija nije samo za čitanje — prekinuto.");
    process.exit(1);
  }
}
const existing = new Set([...(await db.execute<{ id: string }>(sql`SELECT customer_id::text AS id FROM customer_sales_contacts`))].map((r) => r.id));
const known = new Set([...(await db.execute<{ id: string }>(sql`SELECT id::text FROM customers`))].map((r) => r.id));

const ready: { row: Row; value: { contactName: string | null; phone: string | null; phoneAlt: string | null; email: string | null; note: string | null } }[] = [];
const skipped: { sifra: string; naziv: string; razlog: string }[] = [];
for (const r of plan.kontakti) {
  if (!known.has(r.kupac_id)) { skipped.push({ sifra: r.sifra, naziv: r.naziv, razlog: "kupac ne postoji u bazi" }); continue; }
  if (existing.has(r.kupac_id)) { skipped.push({ sifra: r.sifra, naziv: r.naziv, razlog: "već ima kontakt na kartici (ne gazi se)" }); continue; }
  // Više telefona u jednom polju: prvi je glavni, drugi je „drugi telefon“.
  const phones = String(r.telefon ?? "").split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
  const parsed = parseContact({ contactName: r.kontakt, phone: phones[0] ?? null, phoneAlt: phones[1] ?? null, email: r.email, note: r.napomena });
  if (!parsed.ok) {
    // Neispravan telefon ne sme da obori i ispravnu e-poštu: pokušaj bez telefona.
    const withoutPhone = parseContact({ contactName: r.kontakt, phone: null, phoneAlt: null, email: r.email, note: `${r.napomena ?? ""} (telefon iz izvora nije prepoznat: ${r.telefon ?? ""})`.trim() });
    if (!withoutPhone.ok) { skipped.push({ sifra: r.sifra, naziv: r.naziv, razlog: parsed.error }); continue; }
    ready.push({ row: r, value: withoutPhone.value });
    continue;
  }
  if (!parsed.value.email && !parsed.value.phone) { skipped.push({ sifra: r.sifra, naziv: r.naziv, razlog: "nema ni e-pošte ni telefona" }); continue; }
  ready.push({ row: r, value: parsed.value });
}

console.table(ready.slice(0, 400).map(({ row, value }) => ({ sifra: row.sifra, kupac: row.naziv.slice(0, 40), email: value.email ?? "", telefon: value.phone ?? "", kontakt: value.contactName ?? "" })));
if (skipped.length) console.table(skipped);
console.log(`Spremno: ${ready.length}; preskočeno: ${skipped.length} (od ${plan.kontakti.length}).`);
if (!write) {
  console.log("Samo čitanje — ništa nije upisano. Za upis: --potvrdio <email> --upis --production-odobreno");
  process.exit(0);
}

const [actor] = [...(await db.execute<{ id: string; name: string; role: string }>(sql`SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by!}) AND active`))];
if (!actor) {
  console.error(`Nema aktivnog zaposlenog ${by}.`);
  process.exit(1);
}
const written = await db.transaction(async (tx) => {
  let n = 0;
  for (const { row, value } of ready) {
    const res = [...(await tx.execute<{ customer_id: string }>(sql`
      INSERT INTO customer_sales_contacts (customer_id, contact_name, phone, phone_alt, email, note, updated_by, updated_at)
      VALUES (${row.kupac_id}::uuid, ${value.contactName}, ${value.phone}, ${value.phoneAlt}, ${value.email}, ${value.note}, ${actor.id}::uuid, now())
      ON CONFLICT (customer_id) DO NOTHING
      RETURNING customer_id`))];
    n += res.length;
  }
  await recordAudit(
    {
      actor: { id: actor.id, name: actor.name, role: actor.role as never },
      action: AUDIT_ACTIONS.customerContactsImported,
      entityType: "Kontakti kupaca",
      entityId: null,
      entityLabel: `${n} kupaca`,
      after: { upisano: n, preskoceno: skipped.length },
      reason: plan.izvor.slice(0, 500),
    },
    tx as never,
  );
  return n;
});
console.log(`Upisano: ${written}. Upis završen.`);
process.exit(0);
