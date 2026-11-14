/**
 * Ispravka e-pošte u „Kontakt kupca“ (2026-11-14): greške iz izvorne tabele (nevidljiv znak „_x0009_“,
 * slovne greške u domenu, opšta adresa koja nije kupčeva).
 *
 *   scripts/customers/fix-contact-emails.mts <plan.json> [--potvrdio <email> --upis [--production-odobreno]]
 *
 * plan.json: { izvor, ispravke: [{ kupac_id, naziv, staro, novo (null = obriši), razlog }] }
 * Menja SAMO ako je trenutna adresa tačno `staro` (ručna izmena u međuvremenu se ne gazi).
 * Bez `--upis` samo čita. Jedan zapis u dnevniku aktivnosti.
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
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");

type Fix = { kupac_id: string; naziv: string; staro: string; novo: string | null; razlog: string };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor: string; ispravke: Fix[] };
const db = getDb();
if (!write) await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
const ADDR = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const rows = [];
for (const f of plan.ispravke) {
  if (f.novo !== null && !ADDR.test(f.novo)) { console.error(`Neispravna nova adresa: ${f.novo}`); process.exit(1); }
  const [cur] = [...(await db.execute<{ email: string | null }>(sql`SELECT email FROM customer_sales_contacts WHERE customer_id = ${f.kupac_id}::uuid`))];
  rows.push({ kupac: f.naziv.slice(0, 40), staro: f.staro, novo: f.novo ?? "(obriši)", stanje: cur?.email === f.staro ? "spremno" : `preskače se (sada: ${cur?.email ?? "nema"})` });
}
console.table(rows);
if (!write) {
  console.log("Samo čitanje — ništa nije upisano. Za upis: --potvrdio <email> --upis --production-odobreno");
  process.exit(0);
}
const [actor] = [...(await db.execute<{ id: string; name: string; role: string }>(sql`SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by!}) AND active`))];
if (!actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }
const n = await db.transaction(async (tx) => {
  let k = 0;
  for (const f of plan.ispravke) {
    const r = [...(await tx.execute<{ id: string }>(sql`
      UPDATE customer_sales_contacts
         SET email = ${f.novo}, note = left(coalesce(note || ' · ', '') || ${`e-pošta ispravljena: ${f.razlog}`}, 300), updated_by = ${actor.id}::uuid, updated_at = now()
       WHERE customer_id = ${f.kupac_id}::uuid AND email = ${f.staro}
      RETURNING customer_id::text AS id`))];
    k += r.length;
  }
  await recordAudit(
    { actor: { id: actor.id, name: actor.name, role: actor.role as never }, action: AUDIT_ACTIONS.customerContactsImported, entityType: "Kontakti kupaca", entityId: null, entityLabel: `ispravka e-pošte (${k})`, after: { ispravljeno: k }, reason: plan.izvor.slice(0, 500) },
    tx as never,
  );
  return k;
});
console.log(`Ispravljeno: ${n}. Upis završen.`);
process.exit(0);
