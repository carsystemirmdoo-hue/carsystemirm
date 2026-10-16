/**
 * Dopuna sintetičke baze za „Cene po kupcu“ (0057) — pokreće se POSLE `seed-synthetic-portal.mts`
 * nad istom testnom bazom. Samo izmišljeni podaci („SINT …“): osnovni rabati po opciji plaćanja,
 * dogovori za artikal, akcija u toku i zakazana akcija, zakazana nova VP cena, nov artikal sa
 * podrazumevanih 30 %, kupac bez komercijaliste i po jedno interno obaveštenje u oba smera.
 *
 *   TEST_DATABASE_URL=postgres://…/carsystem_cene_kupca_ui_qa \
 *   SYNTH_CREDS_FILE=~/.carsystem-secrets/cene-kupca-sinteticki.json \
 *   npx tsx --tsconfig db/integration/tsconfig.test.json scripts/qa/seed-synthetic-cene-kupca.mts
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { evaluateTestTarget, SAFETY_MESSAGES } from "../../db/integration/safety.mjs";
import { precedenceLevelFor, scopeKeyFor } from "../../lib/pricing/precedence.mjs";
import { addDays } from "../../lib/pricing/rebateSheet.mjs";

const decision = evaluateTestTarget({ testUrl: process.env.TEST_DATABASE_URL, databaseUrl: process.env.DATABASE_URL, migrationUrl: process.env.MIGRATION_DATABASE_URL, vercelEnv: process.env.VERCEL_ENV });
if (!decision.ok) {
  console.error(SAFETY_MESSAGES[decision.reason as keyof typeof SAFETY_MESSAGES] ?? decision.reason);
  process.exit(1);
}
const creds = JSON.parse(readFileSync(process.env.SYNTH_CREDS_FILE as string, "utf8")) as { ids: Record<string, string> };
const ids = creds.ids;
const sql = postgres(process.env.TEST_DATABASE_URL as string, { max: 1, onnotice: () => {} });
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());

async function rule(customerId: string, scope: { productScope: "article" | "all"; articleId?: string }, pct: number, cond: string | null, opts: { from?: string; to?: string | null; kind?: "redovni" | "akcija"; by?: string } = {}) {
  const s = { customerScope: "customer", customerId, ...scope, paymentCondition: cond };
  await sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, effective_to, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, payment_condition, rule_kind)
    VALUES ('customer', ${customerId}, ${scope.productScope}, ${scope.articleId ?? null}, ${precedenceLevelFor(s)}, ${scopeKeyFor(s)}, 'discount_percent', ${pct},
            ${opts.from ?? "2026-01-01"}, ${opts.to ?? null}, 'approved_pending_biznisoft', 'sintetički dogovor', ${opts.by ?? ids.vlasnik}, now(), ${opts.by ?? ids.vlasnik}, now(), false, ${cond}, ${opts.kind ?? "redovni"})`;
}

const A = ids.A;
const B = ids.B;
const C = ids.C;
await sql`UPDATE customers SET city = 'Novi Sad' WHERE id = ${A}`;
await sql`UPDATE customers SET city = 'Pančevo' WHERE id = ${B}`;
await sql`UPDATE customers SET city = 'Zrenjanin' WHERE id = ${C}`;
for (const c of [B, C]) {
  for (const o of ["avans", "odlozeno_30"]) {
    await sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
              VALUES (${c}, ${o}, 'odobreno', '2026-01-01', 'sintetički odobreno', ${ids.vlasnik}, ${ids.vlasnik}, now())
              ON CONFLICT DO NOTHING`;
  }
}
const ARTS = [
  ["SINT-L05", "SINT 2K HS BEZBOJNI LAK, SJAJNI", "l", "kanta 5 l", 5, "2190.00", "2290.00"],
  ["SINT-L01", "SINT 2K HS BEZBOJNI LAK, SJAJNI", "l", "limenka 1 l", 1, "2360.00", "2466.00"],
  ["SINT-U25", "SINT UČVRŠĆIVAČ ZA HS LAK, NORMALNI", "l", "limenka 2,5 l", 2.5, "2850.00", "2978.00"],
  ["SINT-U05", "SINT UČVRŠĆIVAČ ZA HS LAK, BRZI", "l", "limenka 0,5 l", 0.5, "3120.00", null],
  ["SINT-R05", "SINT RAZREĐIVAČ ZA AKRILNE SISTEME", "l", "kanta 5 l", 5, "980.00", null],
  ["SINT-K18", "SINT KIT SA STAKLENIM VLAKNIMA", "kg", "kanta 1,8 kg", 1.8, "1450.00", "1515.00"],
  ["SINT-D24", "SINT BRUSNI DISK 150 MM, P240", "kom", "kutija 100 kom", 100, "38.00", "40.00"],
  ["SINT-T19", "SINT MASKIRNA TRAKA 19 MM × 50 M", "kom", "rolna", 1, "236.00", "247.00"],
  ["SINT-F41", "SINT ZAŠTITNA FOLIJA 4 × 150 M", "kom", "rolna", 1, "3860.00", null],
  ["SINT-PP1", "SINT PASTA ZA POLIRANJE, ZAVRŠNA", "kg", "limenka 1 kg", 1, "4580.00", "4786.00"],
] as const;
const art: Record<string, string> = {};
for (const [code, name, unit, label, qty, price, next] of ARTS) {
  const [a] = await sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, product_group) VALUES (${code}, ${name}, ${unit}, 'SINT grupa') RETURNING id`;
  art[code] = a.id;
  await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'sintetička VP cena', ${ids.vlasnik})`;
  if (next) await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${a.id}, ${next}, '20', ${addDays(today, 15)}, 'rucno', 'sintetička nova VP cena', ${ids.vlasnik})`;
  await sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${a.id}, ${qty}, ${unit}, ${label}, 'sintetičko pakovanje', ${ids.vlasnik})`;
}
const [nov] = await sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, product_group) VALUES ('SINT-NOV1', 'SINT BAZNA BOJA VODENA, PLAVA PERLA', 'l', 'SINT grupa') RETURNING id`;
await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by) VALUES (${nov.id}, '6960.00', '20', '2026-01-01', 'rucno', 'sintetička VP cena', ${ids.vlasnik})`;
await sql`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by) VALUES (${nov.id}, 0.5, 'l', 'limenka 0,5 l', 'sintetičko pakovanje', ${ids.vlasnik})`;
await sql`INSERT INTO article_new_defaults (article_id, created_by) VALUES (${nov.id}, ${ids.vlasnik})`;

for (const [c, odl, av] of [[A, 18, 23], [B, 22, 26], [C, 10, 14]] as const) {
  await rule(c, { productScope: "all" }, odl, "odlozeno_30");
  await rule(c, { productScope: "all" }, av, "avans");
}
await rule(A, { productScope: "article", articleId: art["SINT-K18"] }, 24, "odlozeno_30", { from: "2026-09-21", by: ids.petar });
await rule(A, { productScope: "article", articleId: art["SINT-K18"] }, 29, "avans", { from: "2026-09-21", by: ids.petar });
await rule(A, { productScope: "article", articleId: art["SINT-T19"] }, 24, "odlozeno_30", { from: "2026-09-21" });
await rule(A, { productScope: "article", articleId: art["SINT-T19"] }, 29, "odlozeno_30", { from: addDays(today, -15), to: addDays(today, 45), kind: "akcija" });
await rule(A, { productScope: "article", articleId: art["SINT-D24"] }, 28, "odlozeno_30", { from: "2026-01-01" });
await rule(A, { productScope: "article", articleId: art["SINT-D24"] }, 33, "odlozeno_30", { from: addDays(today, 20), to: addDays(today, 50), kind: "akcija" });
await rule(A, { productScope: "article", articleId: nov.id }, 27, "avans", { from: today, by: ids.petar });

const items = (before: string, after: string, name: string, code: string, option: string) => sql.json([{ code, name, option, before, after }]);
await sql`INSERT INTO rebate_change_notices (recipient_user_id, actor_user_id, customer_id, source_batch, period, items, note)
          VALUES (${ids.vlasnik}, ${ids.petar}, ${A}, 'cene-kupca-sint-1', 'od danas, bez isteka', ${items("18 % · 1.795,80", "24 % · 1.664,40", "SINT 2K HS BEZBOJNI LAK, SJAJNI", "SINT-L05", "Odloženo plaćanje — 30 dana")}, 'Kupac preuzima veću količinu laka.')`;
await sql`INSERT INTO rebate_change_notices (recipient_user_id, actor_user_id, customer_id, source_batch, period, items, note)
          VALUES (${ids.petar}, ${ids.vlasnik}, ${A}, 'cene-kupca-sint-2', 'od danas, bez isteka', ${items("23 % · 1.116,50", "26 % · 1.073,00", "SINT KIT SA STAKLENIM VLAKNIMA", "SINT-K18", "Avansno plaćanje")}, null)`;
console.log("Dopuna za cene po kupcu: 11 artikala, osnovni rabati za 3 kupca, akcije, nov artikal 30 %, 2 obaveštenja.");
await sql.end();
