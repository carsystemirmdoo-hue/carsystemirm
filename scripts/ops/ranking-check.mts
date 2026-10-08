/**
 * Provera redosleda R1 prema dosadašnjem nad bazom — SAMO ČITANJE.
 *
 *   DATABASE_URL=<pilot ili lokalni prikaz, runtime uloga> \
 *     npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/ranking-check.mts \
 *       --kraj 2025-01-31 [--od 2022-01-01] [--horizonti 30,45,60]
 *
 * Ulaz je ISKLJUČIVO `recommendation_input_lines` (isti pogled kao obračun):
 * važeće originalne fakture potvrđeno mapiranih kupaca; storna, sporne revizije
 * i dokumenti na pregledu nisu u njemu. `--kraj` je poslednji POTPUNI dan
 * uvezenih podataka — presek ulazi u horizont samo ako mu ceo prozor staje do
 * tog dana. Ne upisuje ništa; na ekran idu samo zbirni brojevi, bez kupaca i
 * artikala. Metod: docs/b2b/46.
 */
import { compareByCustomer, evaluateCut, monthlyCuts } from "../../lib/recommendations/rankingBacktest.mjs";
import { legacySuggestions, rankSuggestions } from "../../lib/recommendations/suggestionRanking.mjs";

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Postavite DATABASE_URL ciljne baze (runtime uloga).");
  const kraj = arg("kraj");
  if (!kraj || !/^\d{4}-\d{2}-\d{2}$/.test(kraj)) throw new Error("Nedostaje --kraj GGGG-MM-DD (poslednji potpuni dan podataka).");
  const od = arg("od") ?? "2022-01-01";
  const horizonti = (arg("horizonti") ?? "30,45,60").split(",").map(Number);

  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  await sql`SET default_transaction_read_only = on`;
  const rows = await sql<{ c: string; a: string; d: string }[]>`
    SELECT DISTINCT customer_id::text AS c, article_code AS a, issued_on::text AS d
      FROM recommendation_input_lines WHERE issued_on <= ${kraj}`;
  await sql.end();

  const perCustomer = new Map<string, { article: string; date: string }[]>();
  for (const r of rows) perCustomer.set(r.c, [...(perCustomer.get(r.c) ?? []), { article: r.a, date: r.d }]);
  console.log(`Ulaz do ${kraj}: kupaca ${perCustomer.size}, događaja (kupac, artikal, dan) ${rows.length}.`);
  if (perCustomer.size === 0) return;

  const rules = { R0: (r: never[]) => legacySuggestions(r).main, R1: (r: never[]) => rankSuggestions(r).main };
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`);
  for (const H of horizonti) {
    const cuts = monthlyCuts(od, kraj, H);
    if (!cuts.length) { console.log(`H=${H}: nema preseka sa punim prozorom do ${kraj}.`); continue; }
    const records: { customer: string; cut: NonNullable<ReturnType<typeof evaluateCut>> }[] = [];
    let i = 0;
    for (const events of perCustomer.values()) {
      i += 1;
      for (const asOf of cuts) {
        const cut = evaluateCut(events, asOf, { horizonDays: H, limit: 5, rules });
        if (cut) records.push({ customer: `k${i}`, cut });
      }
    }
    const all = compareByCustomer(records, "R0", "R1").sve;
    console.log(`\nH=${H} · preseka ${cuts.length} (${cuts[0]} … ${cuts[cuts.length - 1]}) · kupaca sa presekom ${all?.kupaca ?? 0}, uporedivo ${all?.kupacaUporedivo ?? 0}`);
    if (!all) continue;
    console.log(`  svi: dosadašnji ${pct(all.R0.prosek)} → R1 ${pct(all.R1.prosek)} · bolje/isto/gore ${all.bolje}/${all.isto}/${all.gore}`);
    for (const [g, s] of Object.entries(compareByCustomer(records, "R0", "R1", (r) => r.cut.segment))) {
      console.log(`  ${g.padEnd(10)} uporedivo ${String(s.kupacaUporedivo).padStart(4)}/${s.kupaca} · ${pct(s.R0.prosek)} → ${pct(s.R1.prosek)} · bolje/isto/gore ${s.bolje}/${s.isto}/${s.gore}`);
    }
  }
}

main().catch((e) => {
  console.error((e as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "***"));
  process.exit(1);
});
