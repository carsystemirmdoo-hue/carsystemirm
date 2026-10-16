/**
 * Demo profil TEST kupca za „Za Vas“ (kartice i lični redosled): sintetička istorija i demo cene.
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-customer-demo.mts <plan.json> [--potvrdio <email> --upis [--production-odobreno]]
 *
 * Plan (PRIVATAN): { pib, label, faktorCene, kupovine: [{ sifra, daniUnazad, dok, kolicina }] }.
 * Upisuje SAMO `system_settings['customer.demo']` (nikad fakture, cenovnik ni izveštaje). Kupac mora biti
 * izdvojeni test kupac (ordering.trial). Šifre: potvrđena veza sa katalogom, u programu, bez opreme,
 * sa osnovnom cenom (demo cena = osnovna × faktorCene, jasno označena na sajtu). Bez `--upis` samo
 * proverava (sesija samo za čitanje). Isti sadržaj → bez upisa (idempotentno); upis i audit u transakciji.
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const [planPath, ...rest] = process.argv.slice(2);
const arg = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const write = rest.includes("--upis");
const by = arg("--potvrdio");
if (!planPath || (write && !by)) { console.error("Upotreba: <plan.json> [--potvrdio <email> --upis]"); process.exit(1); }
if (write && /neon\.tech|neon\.build/.test(process.env.DATABASE_URL ?? "") && !rest.includes("--production-odobreno")) {
  console.error("Production baza: upis traži --production-odobreno. Prekinuto.");
  process.exit(1);
}
if (!write) process.env.DATABASE_POOL_MAX = "1";
const { getDb } = await import("@/db/client");
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");
const { DEMO_SETTING } = await import("@/lib/customers/for-you");

type Plan = { pib: string; label: string; faktorCene: number; kupovine: { sifra: string; daniUnazad: number; dok: string; kolicina: number }[] };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") { console.error("Sesija nije samo za čitanje — prekinuto."); process.exit(1); }
}
const problems: string[] = [];
const [customer] = [...(await db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM customers WHERE pib = ${plan.pib}`))];
if (!customer) problems.push(`kupac ${plan.pib} ne postoji`);
const [trial] = [...(await db.execute<{ value: { customerIds?: string[] } }>(sql`SELECT value FROM system_settings WHERE key = 'ordering.trial'`))];
if (customer && !(trial?.value?.customerIds ?? []).includes(customer.id)) problems.push("kupac nije izdvojeni test kupac (ordering.trial) — demo se ne upisuje stvarnoj firmi");
if (!(plan.faktorCene > 0 && plan.faktorCene <= 1)) problems.push("faktorCene mora biti u (0, 1]");
const codes = [...new Set(plan.kupovine.map((k) => k.sifra))];
const rows = codes.length
  ? [...(await db.execute<{ code: string; ok: boolean; price: string | null }>(sql`
      SELECT a.code,
             (EXISTS (SELECT 1 FROM article_catalog_mappings m WHERE m.article_id = a.id AND m.status = 'mapped')
              AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
              AND NOT EXISTS (SELECT 1 FROM internal_equipment e WHERE e.code_key = regexp_replace(a.code, '^0+(?=[0-9])', ''))) AS ok,
             (SELECT b.net_price::text FROM article_base_prices b WHERE b.article_id = a.id ORDER BY b.valid_from DESC LIMIT 1) AS price
        FROM articles a WHERE a.code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`))]
  : [];
const byCode = new Map(rows.map((r) => [r.code, r]));
const prices: Record<string, number> = {};
for (const c of codes) {
  const r = byCode.get(c);
  if (!r) { problems.push(`${c}: nema u bazi`); continue; }
  if (!r.ok) { problems.push(`${c}: nije potvrđena veza / van programa / oprema`); continue; }
  if (!r.price) { problems.push(`${c}: nema osnovne cene za demo cenu`); continue; }
  prices[c] = Math.round(Number(r.price) * plan.faktorCene * 100) / 100;
}
for (const k of plan.kupovine) if (!(k.daniUnazad >= 0 && k.kolicina > 0 && k.dok)) problems.push(`${k.sifra}: neispravna kupovina`);
const profile = {
  label: plan.label,
  events: plan.kupovine.map((k) => ({ code: k.sifra, daysAgo: k.daniUnazad, doc: k.dok, qty: k.kolicina })),
  prices,
};
console.log(`Kupac: ${customer?.name ?? "—"} · artikala ${codes.length} · kupovina ${new Set(plan.kupovine.map((k) => k.dok)).size} · stavki ${plan.kupovine.length}`);
if (problems.length) { console.log(`ODBIJENO:\n- ${problems.join("\n- ")}`); process.exit(write ? 1 : 0); }
const [cur] = [...(await db.execute<{ value: { profiles?: Record<string, unknown> } }>(sql`SELECT value FROM system_settings WHERE key = ${DEMO_SETTING}`))];
// jsonb ne čuva redosled ključeva: poređenje posle kanonskog sređivanja.
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
const same = JSON.stringify(canon(cur?.value?.profiles?.[customer!.id] ?? null)) === JSON.stringify(canon(profile));
console.log(same ? "Već upisano (isti sadržaj)." : `Spremno${write ? "" : " — samo plan (bez --upis ništa nije upisano)"}.`);
if (write && !same) {
  const [actor] = [...(await db.execute<{ id: string; name: string; role: string }>(sql`SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))];
  if (!actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }
  const next = { profiles: { ...(cur?.value?.profiles ?? {}), [customer!.id]: profile } };
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (${DEMO_SETTING}, ${JSON.stringify(next)}::jsonb, ${actor.id}::uuid, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`);
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role as never },
        action: AUDIT_ACTIONS.customerDemoSet,
        entityType: "Kupac",
        entityId: customer!.id,
        entityLabel: customer!.name.slice(0, 200),
        before: cur?.value?.profiles?.[customer!.id] ? { postojao: true } : null,
        after: { artikala: codes.length, kupovina: new Set(plan.kupovine.map((k) => k.dok)).size, faktorCene: plan.faktorCene },
        reason: `Demo podaci test kupca (${plan.label}); izolovano od faktura, cenovnika i izveštaja.`,
      },
      tx as never,
    );
  });
  console.log("Upisano.");
}
process.exit(0);
