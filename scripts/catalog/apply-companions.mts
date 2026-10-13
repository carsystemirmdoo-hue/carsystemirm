/**
 * Upis POTVRĐENOG pribora koji se prodaje odvojeno (0048: posuda → poklopac, lak/filer → herter;
 * odluke vlasnika 2026-10-13).
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-companions.mts <plan.json> [--potvrdio <email> --upis]
 *
 * Plan (PRIVATAN, van repoa): { izvor, parovi: [{ artikal, pribor, vrsta: "poklopac" | "herter", dokaz,
 *   opcija?, izvor_url?, odnos?: { osnova, pribor, baza: "zapremina" | "masa" | null } }] } — šifre iz BizniSofta.
 * Herter: obavezan `izvor_url` (tehnički list proizvođača); odnos samo kako ga list navodi.
 * Odbija se herter uz artikal koji ga već sadrži (set A+B, „sa herterom“).
 * Bez `--upis` samo proverava (sesija samo za čitanje). Sajt pribor samo PREDLAŽE; ništa ne dodaje u korpu.
 * Production baza (neon) se odbija bez `--production-odobreno`.
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const [planPath, ...rest] = process.argv.slice(2);
const arg = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const write = rest.includes("--upis");
const by = arg("--potvrdio");
if (!planPath || (write && !by)) {
  console.error("Upotreba: <plan.json> [--potvrdio <email> --upis]");
  process.exit(1);
}
const url = process.env.DATABASE_URL ?? "";
if (write && /neon\.tech|neon\.build/.test(url) && !rest.includes("--production-odobreno")) {
  console.error("Production baza: upis traži posebno odobrenje vlasnika (--production-odobreno). Prekinuto.");
  process.exit(1);
}
if (!write) process.env.DATABASE_POOL_MAX = "1";

const { getDb } = await import("@/db/client");

type Pair = {
  artikal: string; pribor: string; vrsta: string; dokaz: string;
  opcija?: string; izvor_url?: string; odnos?: { osnova: number; pribor: number; baza: "zapremina" | "masa" | null };
};
const CONTAINS_HARDENER = /A\s*\+\s*B|SA\s+HERTER|\bSET\b|KOMPLET/i;
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor?: string; parovi: Pair[] };
const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") { console.error("Sesija nije samo za čitanje — prekinuto."); process.exit(1); }
}
const [{ has }] = [...(await db.execute<{ has: boolean }>(sql`SELECT to_regclass('public.article_companions') IS NOT NULL AS has`))];
if (!has) console.log("UPOZORENJE: migracija 0048 (article_companions) nije primenjena na ovoj bazi — parovi se ne mogu upisati.");
const [actor] = by ? [...(await db.execute<{ id: string }>(sql`SELECT id FROM users WHERE lower(email) = lower(${by}) AND active`))] : [];
if (write && !actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }

const byCode = async (code: string) =>
  [...(await db.execute<{ id: string; name: string; out: boolean }>(sql`
    SELECT a.id, a.name, EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out
      FROM articles a WHERE a.code = ${code}`))][0];
const rows: Record<string, unknown>[] = [];
for (const p of plan.parovi) {
  const [a, c] = [await byCode(p.artikal), await byCode(p.pribor)];
  const problems: string[] = [];
  if (!a) problems.push("artikal ne postoji u bazi");
  if (!c) problems.push("pribor ne postoji u bazi");
  if (c?.out) problems.push("pribor je van programa");
  if (!["poklopac", "herter", "kompatibilno"].includes(p.vrsta)) problems.push(`nepoznata vrsta „${p.vrsta}“`);
  if (p.vrsta === "herter" && !/^https:\/\//.test(p.izvor_url ?? "")) problems.push("herter bez linka na tehnički list");
  if (p.vrsta === "herter" && a && CONTAINS_HARDENER.test(a.name)) problems.push("osnovni artikal već sadrži herter");
  if (p.odnos && !(p.odnos.osnova > 0 && p.odnos.pribor > 0)) problems.push("neispravan odnos");
  if (p.odnos?.baza && !["zapremina", "masa"].includes(p.odnos.baza)) problems.push("osnova odnosa mora biti zapremina ili masa");
  if ((p.dokaz ?? "").trim().length < 5) problems.push("nedostaje dokaz");
  if (p.artikal === p.pribor) problems.push("artikal i pribor su isti");
  const already =
    has && a && c
      ? Boolean([...(await db.execute(sql`SELECT 1 FROM article_companions WHERE article_id = ${a.id}::uuid AND companion_article_id = ${c.id}::uuid AND revoked_at IS NULL`))].length)
      : false;
  rows.push({ artikal: p.artikal, naziv: a?.name ?? "—", pribor: p.pribor, priborNaziv: c?.name ?? "—", stanje: problems.length ? `ODBIJENO: ${problems.join("; ")}` : already ? "već upisano" : "spremno", _a: a?.id, _c: c?.id, _ok: !problems.length && has, _already: already, _p: p });
}
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")))));
const ready = rows.filter((r) => r._ok && !r._already);
console.log(`Spremno: ${rows.filter((r) => r._ok).length} / ${rows.length}${write ? "" : " — samo plan (bez --upis ništa nije upisano)"}`);
if (write) {
  for (const r of ready) {
    const p = r._p as Pair;
    await db.execute(sql`
      INSERT INTO article_companions (article_id, companion_article_id, kind, evidence, confirmed_by, option_label, source_url, ratio_base, ratio_companion, ratio_basis)
      VALUES (${r._a as string}::uuid, ${r._c as string}::uuid, ${p.vrsta}, ${`${p.dokaz} (${plan.izvor ?? "potvrda vlasnika"})`.slice(0, 500)}, ${actor.id}::uuid,
              ${p.opcija ?? null}, ${p.izvor_url ?? null}, ${p.odnos?.osnova ?? null}, ${p.odnos?.pribor ?? null}, ${p.odnos?.baza ?? null})`);
  }
  console.log(`Upisano: ${ready.length}.`);
}
process.exit(0);
