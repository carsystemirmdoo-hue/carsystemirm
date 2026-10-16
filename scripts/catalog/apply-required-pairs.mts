/**
 * Upis OBAVEZNOG para u jednakoj količini (0056: blanko posuda → poklopac; odluka vlasnika 16. 10. 2026).
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-required-pairs.mts <plan.json> [--potvrdio <email> --upis]
 *
 * Plan (PRIVATAN, van repoa): { izvor, parovi: [{ posuda, poklopac, dokaz }] } — šifre iz BizniSofta.
 * Provera: obe šifre postoje i u programu su, obe imaju potvrđeno pakovanje 1 KOM (jednak broj = isti
 * broj komada), i par već postoji kao potvrđen pribor `poklopac` (0048) — ne izvodi se iz naziva.
 * Bez `--upis` samo proverava (sesija samo za čitanje). Production (neon) traži `--production-odobreno`.
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
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");

type Pair = { posuda: string; poklopac: string; dokaz: string };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor?: string; parovi: Pair[] };
const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") { console.error("Sesija nije samo za čitanje — prekinuto."); process.exit(1); }
}
const [{ has }] = [...(await db.execute<{ has: boolean }>(sql`SELECT to_regclass('public.article_required_pairs') IS NOT NULL AS has`))];
if (!has) console.log("UPOZORENJE: migracija 0056 (article_required_pairs) nije primenjena na ovoj bazi — parovi se ne mogu upisati.");
const [actor] = by ? [...(await db.execute<{ id: string; name: string; role: string }>(sql`SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))] : [];
if (write && !actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }

const byCode = async (code: string) =>
  [...(await db.execute<{ id: string; name: string; unit: string | null; out: boolean; pack_quantity: string | null; pack_unit: string | null }>(sql`
    SELECT a.id, a.name, a.unit, EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out,
           ps.pack_quantity::text AS pack_quantity, ps.unit AS pack_unit
      FROM articles a LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id WHERE a.code = ${code}`))][0];
const rows: Record<string, unknown>[] = [];
for (const p of plan.parovi) {
  const [a, c] = [await byCode(p.posuda), await byCode(p.poklopac)];
  const problems: string[] = [];
  for (const [label, x] of [["posuda", a], ["poklopac", c]] as const) {
    if (!x) { problems.push(`${label} ne postoji u bazi`); continue; }
    if (x.out) problems.push(`${label} je van programa`);
    if (!(x.pack_unit === "KOM" && Number(x.pack_quantity) === 1)) problems.push(`${label} nema potvrđeno pakovanje 1 KOM`);
  }
  if (p.posuda === p.poklopac) problems.push("posuda i poklopac su ista šifra");
  if ((p.dokaz ?? "").trim().length < 5) problems.push("nedostaje dokaz");
  if (a && c) {
    const [comp] = [...(await db.execute(sql`
      SELECT 1 FROM article_companions WHERE article_id = ${a.id}::uuid AND companion_article_id = ${c.id}::uuid AND kind = 'poklopac' AND revoked_at IS NULL`))];
    if (!comp) problems.push("par nije potvrđen kao pribor „poklopac“ (0048)");
  }
  const already = has && a && c
    ? Boolean([...(await db.execute(sql`SELECT 1 FROM article_required_pairs WHERE article_id = ${a.id}::uuid AND companion_article_id = ${c.id}::uuid AND revoked_at IS NULL`))].length)
    : false;
  rows.push({ posuda: p.posuda, naziv: a?.name ?? "—", poklopac: p.poklopac, poklopacNaziv: c?.name ?? "—", stanje: problems.length ? `ODBIJENO: ${problems.join("; ")}` : already ? "već upisano" : "spremno", _a: a?.id, _c: c?.id, _ok: !problems.length && has, _already: already, _p: p });
}
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")))));
const ready = rows.filter((r) => r._ok && !r._already);
console.log(`Spremno: ${rows.filter((r) => r._ok).length} / ${rows.length}${write ? "" : " — samo plan (bez --upis ništa nije upisano)"}`);
if (write) {
  for (const r of ready) {
    const p = r._p as Pair;
    const evidence = `${p.dokaz} (${plan.izvor ?? "odluka vlasnika"})`.slice(0, 1000);
    // Par i njegov audit u istoj transakciji; ponovljen upis ne pravi drugi red (PK).
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO article_required_pairs (article_id, companion_article_id, evidence, decided_by)
        VALUES (${r._a as string}::uuid, ${r._c as string}::uuid, ${evidence}, ${actor.id}::uuid)
        ON CONFLICT (article_id, companion_article_id) DO NOTHING`);
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role as never },
          action: AUDIT_ACTIONS.requiredPairSet,
          entityType: "Artikal",
          entityId: r._a as string,
          entityLabel: `${p.posuda} → ${p.poklopac} (obavezno 1:1)`,
          before: null,
          after: { poklopac: p.poklopac, odnos: "1 posuda = 1 poklopac" },
          reason: evidence,
        },
        tx as never,
      );
    });
  }
  console.log(`Upisano: ${ready.length}.`);
}
process.exit(0);
