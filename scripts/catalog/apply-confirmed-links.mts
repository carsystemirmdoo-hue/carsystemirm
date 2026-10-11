/**
 * Upis POTVRĐENIH veza BizniSoft artikal → katalog i potvrđenih pakovanja (dok. 61).
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-confirmed-links.mts <plan.json> --potvrdio <email> [--upis | --povuci "<razlog>"]
 *
 * Plan (PRIVATAN, van repoa): { veze: [{ sifra, slug, varijanta|null, jm, pakovanje|null, oznaka, izvor? }], izvor }.
 * Bez `--upis` samo proverava i ispisuje plan. Veza se upisuje kroz `decideMapping`
 * (isti put kao ekran Mapiranja: audit, istorija); pakovanje u `article_pack_sizes`.
 * `--povuci "<razlog>"` je povratak: veze iz plana koje su potvrđene na isti cilj prelaze u
 * `revoked` (kroz `decideMapping`, sa razlogom), a pakovanja iz plana se brišu.
 * Production baza (neon) se odbija bez `--production-odobreno` — upis tamo traži
 * posebno odobrenje vlasnika.
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const [planPath, ...rest] = process.argv.slice(2);
const arg = (k: string) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const revokeReason = arg("--povuci");
const write = rest.includes("--upis") || Boolean(revokeReason);
if (rest.includes("--upis") && revokeReason) {
  console.error("--upis i --povuci se ne kombinuju.");
  process.exit(1);
}
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
// Plan bez upisa radi na JEDNOJ vezi zaključanoj na samo čitanje (sme i nad Production-om).
if (!write) process.env.DATABASE_POOL_MAX = "1";

const { getDb } = await import("@/db/client");
const { decideMapping } = await import("@/lib/commercial/mapping-service");
const { catalogOfferFacts } = await import("@/lib/ordering/ordering-service");
const { orderPack } = await import("@/lib/ordering/packRule.mjs");

type Link = { sifra: string; slug: string; varijanta: string | null; jm: string; pakovanje: number | null; oznaka?: string; izvor?: string };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor?: string; veze: Link[] };
const db = getDb();
if (!write) {
  await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
  if (ro?.transaction_read_only !== "on") { console.error("Sesija nije samo za čitanje — prekinuto."); process.exit(1); }
}
const [actor] = by
  ? [...(await db.execute<{ id: string; name: string; role: string }>(sql`
      SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))]
  : [];
if (write && !actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }

// Bez 0047 nema tabele pakovanja: veze se mogu proveriti, pakovanja ne (i ne mogu se upisati).
const [{ has }] = [...(await db.execute<{ has: boolean }>(sql`SELECT to_regclass('public.article_pack_sizes') IS NOT NULL AS has`))];
if (!has) console.log("UPOZORENJE: migracija 0047 (article_pack_sizes) nije primenjena na ovoj bazi — pakovanja se ne mogu upisati dok se ne primeni.");
const rows: Record<string, unknown>[] = [];
for (const v of plan.veze) {
  const [a] = [...(await db.execute<{ id: string; name: string; unit: string | null; out: boolean; status: string | null; slug: string | null; variant: string | null; pq: string | null; pu: string | null; fractional: boolean }>(sql`
    SELECT a.id, a.name, a.unit,
           EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out,
           m.status::text AS status, m.catalog_product_slug AS slug, m.catalog_variant_id AS variant,
           ${has ? sql`ps.pack_quantity::text` : sql`NULL::text`} AS pq, ${has ? sql`ps.unit` : sql`NULL::text`} AS pu,
           EXISTS (SELECT 1 FROM invoice_lines l WHERE l.article_id = a.id AND l.quantity <> trunc(l.quantity)) AS fractional
      FROM articles a
      LEFT JOIN article_catalog_mappings m ON m.article_id = a.id
      ${has ? sql`LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id` : sql``}
     WHERE a.code = ${v.sifra}`))];
  const facts = catalogOfferFacts(v.slug, v.varijanta);
  const problems: string[] = [];
  if (!a) problems.push("artikal ne postoji u bazi");
  else {
    if (String(a.unit ?? "").toUpperCase() !== v.jm.toUpperCase()) problems.push(`JM u bazi ${a.unit} ≠ ${v.jm}`);
    if (a.out) problems.push("artikal je van programa");
    if (a.status === "mapped" && (a.slug !== v.slug || (a.variant ?? null) !== (v.varijanta ?? null))) problems.push(`već potvrđena DRUGA veza (${a.slug}${a.variant ? ` · ${a.variant}` : ""})`);
    if (a.status === "conflict") problems.push("veza je u statusu sukob");
  }
  if (!facts.productExists) problems.push("kataloški proizvod ne postoji");
  else if (v.varijanta && !facts.link?.variantKey) problems.push(`varijanta ${v.varijanta} nije pronađena u katalogu`);
  if (v.pakovanje !== null) {
    const r = orderPack({ unit: v.jm, fractionalSales: a?.fractional, confirmed: { packQuantity: v.pakovanje, unit: v.jm, label: v.oznaka ?? "" } });
    if (r.status !== "pack") problems.push(`pakovanje: ${r.reason}`);
    if (!has) problems.push("pakovanje: 0047 nije primenjena");
    if (a?.pq && (Number(a.pq) !== Number(v.pakovanje) || a.pu !== v.jm.toUpperCase())) problems.push(`već postoji DRUGO pakovanje (${a.pq} ${a.pu})`);
  }
  const already = a?.status === "mapped" && a.slug === v.slug && (a.variant ?? null) === (v.varijanta ?? null);
  rows.push({ sifra: v.sifra, naziv: a?.name ?? "—", jm: v.jm, katalog: facts.link?.name ?? v.slug, varijanta: facts.link?.variantLabel ?? (v.varijanta ? "?" : "(proizvod)"), pakovanje: v.pakovanje === null ? "—" : `${v.pakovanje} ${v.jm} · ${v.oznaka ?? ""}`, stanje: problems.length ? `ODBIJENO: ${problems.join("; ")}` : already ? "veza već potvrđena" : "spremno", _id: a?.id, _ok: !problems.length, _already: already, _v: v });
}
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")))));
const ready = rows.filter((r) => r._ok);
console.log(`Spremno: ${ready.length} / ${rows.length}${write ? "" : " — samo plan (bez --upis ništa nije upisano)"}`);
if (revokeReason) {
  if (revokeReason.trim().length < 5) { console.error("Razlog povlačenja: najmanje 5 znakova."); process.exit(1); }
  let n = 0;
  for (const r of rows) {
    const v = r._v as Link;
    if (!r._id) continue;
    if (r._already) {
      await decideMapping({ articleId: r._id as string, status: "revoked", note: `${revokeReason.trim()} — ${v.sifra}` }, actor);
      n += 1;
    }
    if (has && v.pakovanje !== null) await db.execute(sql`DELETE FROM article_pack_sizes WHERE article_id = ${r._id as string}::uuid`);
  }
  console.log(`Povučeno veza: ${n}.`);
  process.exit(0);
}
if (write) {
  for (const r of ready) {
    const v = r._v as Link;
    if (!r._already) {
      await decideMapping(
        { articleId: r._id as string, status: "mapped", catalogProductSlug: v.slug, catalogVariantId: v.varijanta, note: `${v.izvor ?? plan.izvor ?? "Potvrda vlasnika"} — ${v.sifra}` },
        actor,
      );
    }
    if (v.pakovanje !== null) {
      await db.execute(sql`
        INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by)
        VALUES (${r._id as string}::uuid, ${v.pakovanje}, ${v.jm.toUpperCase()}, ${v.oznaka ?? `${v.pakovanje} ${v.jm}`}, ${v.izvor ?? plan.izvor ?? "potvrda vlasnika"}, ${actor.id}::uuid)
        ON CONFLICT (article_id) DO NOTHING`);
    }
  }
  console.log(`Upisano: ${ready.length}.`);
}
process.exit(0);
