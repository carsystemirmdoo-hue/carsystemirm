/**
 * Predlozi veza artikal → katalog PO NAZIVU (2026-11-11). SAMO ČITA bazu; ništa ne upisuje.
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/name-links.mts <izlaz-folder> [--provera <folder sa planovima *.json>]
 *
 * Izlaz (PRIVATAN, van repoa):
 *   - predlozi.csv  — svaki artikal bez potvrđene veze: najbolji kandidat, ocena, pouzdanost, drugi kandidat;
 *   - provera.csv   — već potvrđene veze (iz baze i iz planova): da li bi predlog pogodio isto.
 * Na ekranu: zbir po brendu i pouzdanosti i tačnost provere unazad.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
  console.error("Upotreba: <izlaz-folder> [--provera <folder>]");
  process.exit(1);
}
const checkDir = rest.includes("--provera") ? rest[rest.indexOf("--provera") + 1] : null;
process.env.DATABASE_POOL_MAX = "1";

const { getDb } = await import("@/db/client");
const { products, getProductVariantSelector } = await import("@/lib/carsystem-data");
const nm = await import("@/lib/catalog/nameMatch.mjs");
const removed = new Set(
  (JSON.parse(readFileSync(new URL("../../data/catalog/removed-from-customer-catalog.json", import.meta.url), "utf8")).records as { slug: string }[]).map((r) => r.slug),
);

// Kataloške mete: varijanta-red (granulacija, nijansa…) ili ceo proizvod kada redova nema.
type Target = { key: string; slug: string; variant: string | null; brand: string; text: string; codes: string[]; label: string };
const targets: Target[] = [];
for (const p of products) {
  if (removed.has(p.slug)) continue;
  const brand = nm.brandKey(p.brandSlug);
  const base = [p.name, (p as { officialName?: string }).officialName ?? ""].join(" ");
  const rows = (getProductVariantSelector(p)?.variants ?? []).filter((v) => !v.slug);
  const pcodes = [p.sku].filter(Boolean) as string[];
  if (!rows.length) {
    targets.push({ key: p.slug, slug: p.slug, variant: null, brand, text: `${base} ${p.sku ?? ""}`, codes: pcodes, label: p.name });
    continue;
  }
  for (const v of rows) {
    const vk = (v.sku ?? v.id) as string;
    targets.push({ key: `${p.slug}#${vk}`, slug: p.slug, variant: vk, brand, text: `${base} ${v.label ?? ""} ${vk}`, codes: [vk, v.sku, v.id].filter(Boolean) as string[], label: `${p.name} — ${v.label ?? vk}` });
  }
}
const index = nm.buildIndex(targets);

const db = getDb();
await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
const [ro] = [...(await db.execute<{ transaction_read_only: string }>(sql`SHOW transaction_read_only`))];
if (ro?.transaction_read_only !== "on") {
  console.error("Sesija nije samo za čitanje — prekinuto.");
  process.exit(1);
}
const arts = [
  ...(await db.execute<{ id: string; code: string; name: string; unit: string | null; status: string | null; slug: string | null; variant: string | null; sold: string | null; out: boolean }>(sql`
    SELECT a.id, a.code, a.name, a.unit, m.status::text AS status, m.catalog_product_slug AS slug, m.catalog_variant_id AS variant,
           (SELECT sum(abs(il.quantity)) FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
             WHERE il.article_id = a.id AND i.issued_on > current_date - 365)::text AS sold,
           EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out
      FROM articles a
      LEFT JOIN article_catalog_mappings m ON m.article_id = a.id AND m.status NOT IN ('rejected', 'revoked')`)),
];

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(";")).join("\n") + "\n";
mkdirSync(outDir, { recursive: true });

// 1) Predlozi za nepovezane.
const out: unknown[][] = [["sifra", "naziv", "jm", "brend", "prodato_12m", "van_programa", "pouzdanost", "ocena", "predlog", "slug", "varijanta", "drugi_kandidat", "drugi_ocena"]];
const summary = new Map<string, Record<string, number>>();
const bump = (brand: string, k: string) => {
  const r = summary.get(brand) ?? {};
  r[k] = (r[k] ?? 0) + 1;
  summary.set(brand, r);
};
let unmapped = 0;
for (const a of arts) {
  if (a.status === "mapped") continue;
  unmapped++;
  const { brand, ranked } = nm.rankTargets(a, index);
  const conf = a.out ? "van programa" : !brand ? "bez brenda" : nm.confidenceOf(ranked);
  const active = Number(a.sold ?? 0) > 0;
  bump(brand ?? "(bez brenda)", `${conf}${active ? "" : " (bez prodaje)"}`);
  const [t1, t2] = ranked;
  out.push([a.code, a.name, a.unit, brand ?? "", a.sold ?? "0", a.out ? "da" : "", conf, t1?.score ?? "", t1?.label ?? "", t1?.slug ?? "", t1?.variant ?? "", t2?.label ?? "", t2?.score ?? ""]);
}
writeFileSync(`${outDir}/predlozi.csv`, csv(out));

// 2) Provera unazad: potvrđene veze iz baze + iz planova (sifra → slug/varijanta).
const known = new Map<string, { slug: string; variant: string | null }>();
for (const a of arts) if (a.status === "mapped" && a.slug) known.set(a.code, { slug: a.slug, variant: a.variant });
if (checkDir) {
  for (const f of readdirSync(checkDir).filter((x) => /skup.*\.json$/.test(x) && !x.startsWith("proba"))) {
    const plan = JSON.parse(readFileSync(`${checkDir}/${f}`, "utf8")) as { veze?: { sifra: string; slug: string | null; varijanta: string | null }[] };
    for (const v of plan.veze ?? []) if (v.slug && !known.has(v.sifra)) known.set(v.sifra, { slug: v.slug, variant: v.varijanta });
  }
}
const byCode = new Map(arts.map((a) => [a.code, a]));
const chk: unknown[][] = [["sifra", "naziv", "pouzdanost", "tacno_proizvod", "tacno_varijanta", "potvrdjeno", "predlog"]];
const acc = new Map<string, { n: number; product: number; exact: number }>();
for (const [code, k] of known) {
  const a = byCode.get(code);
  if (!a) continue;
  const { ranked } = nm.rankTargets(a, index);
  const conf = nm.confidenceOf(ranked);
  const t = ranked[0];
  const okP = t?.slug === k.slug;
  const okV = okP && (t?.variant ?? null)?.toLowerCase() === (k.variant ?? null)?.toLowerCase();
  const r = acc.get(conf) ?? { n: 0, product: 0, exact: 0 };
  r.n++;
  if (okP) r.product++;
  if (okV) r.exact++;
  acc.set(conf, r);
  chk.push([code, a.name, conf, okP ? "da" : "ne", okV ? "da" : "ne", `${k.slug}${k.variant ? `#${k.variant}` : ""}`, t ? t.key : ""]);
}
writeFileSync(`${outDir}/provera.csv`, csv(chk));

console.log(`Artikala: ${arts.length}; potvrđeno povezanih: ${arts.length - unmapped}; bez veze: ${unmapped}. Kataloških meta: ${targets.length}.`);
console.log("\nBez veze, po brendu i pouzdanosti predloga:");
for (const [b, r] of [...summary].sort()) console.log(`  ${b}: ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`\nProvera unazad na ${known.size} potvrđenih veza (da li bi predlog po nazivu pogodio isto):`);
for (const k of ["sigurno", "verovatno", "nejasno", "nema"]) {
  const r = acc.get(k);
  if (r) console.log(`  ${k}: ${r.n} — tačan proizvod ${r.product} (${Math.round((100 * r.product) / r.n)} %), tačna varijanta ${r.exact} (${Math.round((100 * r.exact) / r.n)} %)`);
}
console.log(`\nFajlovi: ${outDir}/predlozi.csv, ${outDir}/provera.csv`);
process.exit(0);
