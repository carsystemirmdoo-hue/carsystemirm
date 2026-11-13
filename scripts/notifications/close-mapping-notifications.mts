/**
 * Jednokratno zatvaranje obaveštenja „Artikal je dobio / Artiklu je oduzet kataloški identitet“
 * (odluka vlasnika 2026-11-13). Svaka veza artikla je pravila po jedno obaveštenje; posle
 * masovnog povezivanja ih je ~959 i zatrpavaju upozorenja o dugovanjima.
 *
 *   scripts/notifications/close-mapping-notifications.mts [--potvrdio <email> --upis [--production-odobreno]]
 *
 * Bez `--upis` SAMO ČITA (sesija READ ONLY) i ispisuje šta bi se zatvorilo.
 * Zatvara SAMO vrstu `mapping_customer_facing_changed` koja nije već zatvorena; upozorenja o
 * dugovanju, porudžbine i pravila rabata se ne diraju. Istorija veza ostaje u dnevniku aktivnosti.
 * Jedan zapis u dnevniku aktivnosti za ceo prolaz (broj, raspon datuma, napomena).
 */
import { sql } from "drizzle-orm";

const rest = process.argv.slice(2);
const arg = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const write = rest.includes("--upis");
const by = arg("--potvrdio");
if (write && !by) {
  console.error("Upotreba: [--potvrdio <email> --upis]");
  process.exit(1);
}
const url = process.env.DATABASE_URL ?? "";
if (write && /neon\.tech|neon\.build/.test(url) && !rest.includes("--production-odobreno")) {
  console.error("Production baza: upis traži posebno odobrenje vlasnika (--production-odobreno). Prekinuto.");
  process.exit(1);
}
if (!write) process.env.DATABASE_POOL_MAX = "1";

const { getDb } = await import("@/db/client");
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");

const NOTE = "Masovno zatvoreno (odluka vlasnika 2026-11-13): zapis o vezi artikla sa katalogom, nije zadatak. Istorija veza je u dnevniku aktivnosti.";
const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") {
    console.error("Sesija nije samo za čitanje — prekinuto.");
    process.exit(1);
  }
}

const summary = [...(await db.execute<{ title: string; status: string; n: number; od: string; do: string; max_id: string }>(sql`
  SELECT title, status::text AS status, count(*)::int AS n, min(created_at)::date::text AS od, max(created_at)::date::text AS do, max(id)::text AS max_id
    FROM notifications
   WHERE kind = 'mapping_customer_facing_changed' AND status <> 'resolved'
   GROUP BY 1, 2 ORDER BY 3 DESC`))];
const total = summary.reduce((a, r) => a + r.n, 0);
const maxId = summary.reduce((m, r) => Math.max(m, Number(r.max_id)), 0);
for (const r of summary) console.log(`  ${r.n.toString().padStart(4)} × ${r.title} (${r.status}, ${r.od} – ${r.do})`);
const others = [...(await db.execute<{ kind: string; n: number }>(sql`
  SELECT kind::text AS kind, count(*)::int AS n FROM notifications
   WHERE kind <> 'mapping_customer_facing_changed' AND status <> 'resolved' GROUP BY 1 ORDER BY 2 DESC`))];
console.log(`Za zatvaranje: ${total}. Ostaju otvorena (ne diraju se): ${others.map((o) => `${o.kind} ${o.n}`).join(", ") || "nijedno"}.`);

if (!write) {
  console.log("\nSamo čitanje — ništa nije upisano. Za upis: --potvrdio <email> --upis --production-odobreno");
  process.exit(0);
}
if (total === 0) {
  console.log("Nema šta da se zatvori.");
  process.exit(0);
}

const [actor] = [...(await db.execute<{ id: string; name: string; role: string }>(sql`
  SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by!}) AND active`))];
if (!actor) {
  console.error(`Nema aktivnog zaposlenog ${by}.`);
  process.exit(1);
}

// Gornja granica je najveći ID viđen gore: obaveštenje nastalo u međuvremenu se ne zatvara naslepo.
const closed = await db.transaction(async (tx) => {
  const rows = [...(await tx.execute<{ id: string }>(sql`
    UPDATE notifications
       SET status = 'resolved', resolved_at = now(), resolved_by = ${actor.id}::uuid, resolution_note = ${NOTE}
     WHERE kind = 'mapping_customer_facing_changed' AND status <> 'resolved' AND id <= ${maxId}
     RETURNING id`))];
  await recordAudit(
    {
      actor: { id: actor.id, name: actor.name, role: actor.role as never },
      action: AUDIT_ACTIONS.notificationResolved,
      entityType: "Obaveštenja",
      entityId: null,
      entityLabel: "Kataloški identitet artikla (masovno)",
      before: { otvoreno: total },
      after: { zatvoreno: rows.length, doId: maxId },
      reason: NOTE,
    },
    tx as never,
  );
  return rows.length;
});
console.log(`\nZatvoreno: ${closed}. Upis završen.`);
process.exit(0);
