/**
 * Upis odluka vlasnika o artiklima: van programa (0040 — uklanjanje iz ponude, istorija ostaje) i
 * samo upit za nabavku (0049 — vidljiv, ne dodaje se u korpu).
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-article-decisions.mts <plan.json> [--potvrdio <email> --upis]
 *
 * Plan (PRIVATAN, van repoa): { izvor, van_programa: [{ sifra, razlog? }], samo_upit: [{ sifra, razlog }],
 *   prodajni_naziv?: [{ sifra, naziv, izvor }], rasprodaja?: [{ sifra, izvor }] }.
 * `prodajni_naziv` (0055): naziv za kupca; izvorni BizniSoft naziv ostaje. `rasprodaja` (0055): artikal se
 * prodaje do isteka zalihe — potvrda lagera sa stanjem 0 ga trajno povlači iz ponude.
 * Bez `--upis` samo proverava (sesija samo za čitanje). Šifra koje nema u bazi se prijavljuje i preskače.
 * Production baza (neon) se odbija bez `--production-odobreno`.
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const [planPath, ...rest] = process.argv.slice(2);
const arg = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const write = rest.includes("--upis");
const by = arg("--potvrdio");
if (!planPath || (write && !by)) { console.error("Upotreba: <plan.json> [--potvrdio <email> --upis]"); process.exit(1); }
const url = process.env.DATABASE_URL ?? "";
if (write && /neon\.tech|neon\.build/.test(url) && !rest.includes("--production-odobreno")) {
  console.error("Production baza: upis traži posebno odobrenje vlasnika (--production-odobreno). Prekinuto.");
  process.exit(1);
}
if (!write) process.env.DATABASE_POOL_MAX = "1";
const { getDb } = await import("@/db/client");
const { setArticleProgramme } = await import("@/lib/pricing/article-programme-service");
const { setArticleProcurementOnly } = await import("@/lib/ordering/article-offer-service");

type Item = { sifra: string; razlog?: string };
type Name = { sifra: string; naziv: string; izvor: string };
type Sellout = { sifra: string; izvor: string };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor: string; van_programa?: Item[]; samo_upit?: Item[]; prodajni_naziv?: Name[]; rasprodaja?: Sellout[] };
const db = getDb();
if (!write) await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
const ids = async (items: Item[]) => {
  const codes = items.map((i) => i.sifra);
  if (!codes.length) return { found: [] as { id: string; code: string }[], missing: [] as string[] };
  const found = [...(await db.execute<{ id: string; code: string }>(sql`SELECT id, code FROM articles WHERE code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`))];
  return { found, missing: codes.filter((c) => !found.some((f) => f.code === c)) };
};
const out = await ids(plan.van_programa ?? []);
const only = await ids(plan.samo_upit ?? []);
console.log(`Van programa: ${out.found.length} u bazi, nema u bazi ${out.missing.length}${out.missing.length ? ` (${out.missing.join(", ")})` : ""}`);
console.log(`Samo upit za nabavku: ${only.found.length} u bazi, nema u bazi ${only.missing.length}${only.missing.length ? ` (${only.missing.join(", ")})` : ""}`);
if (write) {
  const [actor] = [...(await db.execute<{ id: string; name: string; email: string; role: string }>(sql`
    SELECT id, name, email, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))];
  if (!actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }
  const a = await setArticleProgramme(actor as never, { articleIds: out.found.map((f) => f.id), inProgramme: false, reason: plan.izvor.slice(0, 480) });
  console.log(`Van programa — upisano ${a.changed}, već upisano ${a.unchanged}.`);
  const b = await setArticleProcurementOnly(actor as never, { articleIds: only.found.map((f) => f.id), procurementOnly: true, reason: plan.izvor.slice(0, 480) });
  console.log(`Samo upit za nabavku — upisano ${b.changed}, već upisano ${b.unchanged}.`);
  const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");
  let names = 0;
  for (const n of plan.prodajni_naziv ?? []) {
    const [art] = [...(await db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM articles WHERE code = ${n.sifra}`))];
    if (!art) { console.log(`${n.sifra}: nema u bazi — prodajni naziv preskočen`); continue; }
    await db.transaction(async (tx) => {
      const [prev] = [...(await tx.execute<{ name: string }>(sql`SELECT name FROM article_sales_names WHERE article_id = ${art.id}::uuid`))];
      if (prev?.name === n.naziv) return;
      await tx.execute(sql`
        INSERT INTO article_sales_names (article_id, name, evidence, decided_by) VALUES (${art.id}::uuid, ${n.naziv}, ${n.izvor.slice(0, 1000)}, ${actor.id}::uuid)
        ON CONFLICT (article_id) DO UPDATE SET name = EXCLUDED.name, evidence = EXCLUDED.evidence, decided_by = EXCLUDED.decided_by, decided_at = now()`);
      await recordAudit({ actor: { id: actor.id, name: actor.name, role: actor.role as never }, action: AUDIT_ACTIONS.articleSalesNameSet, entityType: "Artikal", entityId: art.id,
        entityLabel: `${n.sifra} ${art.name}`.slice(0, 200), before: { prodajniNaziv: prev?.name ?? null, izvorniNaziv: art.name }, after: { prodajniNaziv: n.naziv }, reason: n.izvor.slice(0, 1000) }, tx as never);
      names++;
    });
  }
  console.log(`Prodajni nazivi — upisano ${names}.`);
  let sellouts = 0;
  for (const r of plan.rasprodaja ?? []) {
    const [art] = [...(await db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM articles WHERE code = ${r.sifra}`))];
    if (!art) { console.log(`${r.sifra}: nema u bazi — rasprodaja preskočena`); continue; }
    await db.transaction(async (tx) => {
      const ins = [...(await tx.execute<{ article_id: string }>(sql`
        INSERT INTO article_sellout (article_id, evidence, decided_by) VALUES (${art.id}::uuid, ${r.izvor.slice(0, 1000)}, ${actor.id}::uuid)
        ON CONFLICT (article_id) DO NOTHING RETURNING article_id`))];
      if (!ins.length) return;
      await recordAudit({ actor: { id: actor.id, name: actor.name, role: actor.role as never }, action: AUDIT_ACTIONS.articleSelloutSet, entityType: "Artikal", entityId: art.id,
        entityLabel: `${r.sifra} ${art.name}`.slice(0, 200), before: null, after: { rasprodaja: true }, reason: r.izvor.slice(0, 1000) }, tx as never);
      sellouts++;
    });
  }
  console.log(`Prodaja do rasprodaje — upisano ${sellouts}.`);
}
process.exit(0);
