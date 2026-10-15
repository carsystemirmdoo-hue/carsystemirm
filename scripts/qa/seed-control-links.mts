/**
 * Lokalna provera deset kontrolnih veza (dok. 61): u SINTETIČKU bazu unosi
 * stvarne artikle iz privatnog snimka (šifra, naziv, JM, osnovna cena i PDV),
 * sa sintetičkim rabatom firme A (20 % / avans 25 %). Veze i pakovanja se zatim
 * upisuju pravim alatom `scripts/catalog/apply-confirmed-links.mts`.
 * Odbija svaku bazu koja nije testna (`db/integration/safety.mjs`).
 *
 *   TEST_DATABASE_URL=… SYNTH_CREDS_FILE=… npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/qa/seed-control-links.mts <potvrde.json> <portal-artikli.json>
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { evaluateTestTarget, SAFETY_MESSAGES } from "../../db/integration/safety.mjs";

const testUrl = process.env.TEST_DATABASE_URL;
const decision = evaluateTestTarget({ testUrl, databaseUrl: process.env.DATABASE_URL, migrationUrl: process.env.MIGRATION_DATABASE_URL, vercelEnv: process.env.VERCEL_ENV });
if (!decision.ok) {
  console.error(SAFETY_MESSAGES[decision.reason as keyof typeof SAFETY_MESSAGES] ?? decision.reason);
  process.exit(1);
}
const [potvrdePath, portalPath] = process.argv.slice(2);
// `proba_cena`: samo za TEHNIČKU probu konverzije (npr. kada izvori cene nisu usklađeni) — sintetička cena.
const potvrde = JSON.parse(readFileSync(potvrdePath, "utf8")) as { veze: { sifra: string; proba_cena?: string }[] };
const portal = new Map((JSON.parse(readFileSync(portalPath, "utf8")) as { code: string; name: string; unit: string; brand: string | null; osnovna: string | null; pdv: string | null }[]).map((a) => [a.code, a]));
const creds = JSON.parse(readFileSync(process.env.SYNTH_CREDS_FILE!, "utf8"));
const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
const sql = postgres(testUrl!, { max: 1, onnotice: () => {} });
const A = creds.ids.A as string;
const owner = creds.ids.vlasnik as string;
let n = 0;
for (const { sifra, proba_cena } of potvrde.veze) {
  const found = portal.get(sifra);
  const p = found && proba_cena ? { ...found, osnovna: proba_cena } : found;
  if (!p) throw new Error(`${sifra}: nema u snimku`);
  const [a] = await sql<{ id: string }[]>`
    INSERT INTO articles (code, name, unit, brand) VALUES (${sifra}, ${p.name}, ${p.unit}, ${p.brand ?? "KONTROLA"})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
  n += 1;
  // Bez osnovne cene u snimku artikal ostaje „Cena na upit“ (ne izmišlja se).
  if (!p.osnovna) continue;
  await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
            VALUES (${a.id}, ${p.osnovna}, ${p.pdv ?? "20"}, '2026-01-01', 'rucno', 'kontrolna veza: osnovna cena iz snimka', ${owner})`;
  for (const [pct, cond] of [[20, null], [25, "avans"]] as const) {
    const s = { customerScope: "customer", customerId: A, productScope: "article", articleId: a.id, paymentCondition: cond };
    await sql`
      INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                               effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, payment_condition)
      VALUES ('customer', ${A}, 'article', ${a.id}, ${precedenceLevelFor(s)}, ${scopeKeyFor(s)}, 'discount_percent', ${pct},
              '2026-01-01', 'approved_pending_biznisoft', 'sintetički rabat (kontrolna veza)', ${owner}, now(), ${owner}, now(), false, ${cond})`;
  }
}
console.log(`Kontrolni artikli u sintetičkoj bazi: ${n} (rabat firme A sintetički 20 % / avans 25 %).`);
await sql.end();
process.exit(0);
