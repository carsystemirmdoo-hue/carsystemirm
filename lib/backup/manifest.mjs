/**
 * Manifest kopije baze — šta je bilo u bazi u trenutku snimka.
 *
 * Pravi se u ISTOJ transakciji (REPEATABLE READ) u kojoj se izvozi snimak za
 * `pg_dump --snapshot`, pa manifest i kopija opisuju isto stanje. Posle
 * vraćanja isti upiti nad vraćenom bazom moraju dati isti rezultat.
 *
 * Sadrži:
 *  - sve osnovne tabele obe šeme (`public`, `drizzle`): broj redova i
 *    kontrolni zbir sadržaja (md5 sortiranog tekstualnog oblika redova);
 *  - verziju migracija (broj i poslednji heš iz `drizzle.__drizzle_migrations`);
 *  - sekvence (poslednja vrednost);
 *  - dozvole aplikacionih uloga nad tabelama;
 *  - kontrolne zbirove prodaje iz `effective_sales_ledger` (po godini i ukupno).
 *
 * Kontrolni zbir sadržaja zavisi od tekstualnog oblika vrednosti, zato se pre
 * upita postavljaju ista podešavanja sesije (`SESSION_SETTINGS`).
 */

export const MANIFEST_SCHEMAS = ["public", "drizzle"];
export const MANIFEST_VERSION = 1;

/** Ista podešavanja na izvoru i na vraćenoj bazi — tekstualni oblik mora biti isti. */
export const SESSION_SETTINGS = [
  "SET TIME ZONE 'UTC'",
  "SET extra_float_digits = 1",
  "SET DateStyle = 'ISO, YMD'",
  "SET IntervalStyle = 'postgres'",
  "SET bytea_output = 'hex'",
];

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

/** Upit za spisak tabela; rezultat: [{ schema, name }]. */
export const TABLES_SQL = `
  SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r', 'p') AND n.nspname IN ('public', 'drizzle')
   ORDER BY 1, 2`;

/** Broj redova i kontrolni zbir jedne tabele (ime je iz kataloga, ne od korisnika). */
export function tableChecksumSql(schema, name) {
  const t = `${ident(schema)}.${ident(name)}`;
  return `SELECT count(*)::bigint AS rows, coalesce(md5(string_agg(x.r, E'\\n' ORDER BY x.r)), md5('')) AS md5
            FROM (SELECT t::text AS r FROM ${t} t) x`;
}

export const SEQUENCES_SQL = `
  SELECT schemaname AS schema, sequencename AS name, coalesce(last_value, 0)::text AS last_value
    FROM pg_sequences WHERE schemaname IN ('public', 'drizzle') ORDER BY 1, 2`;

/** Sekvence vezane za kolonu: posle vraćanja sekvenca mora biti >= najveće vrednosti kolone. */
export const OWNED_SEQUENCES_SQL = `
  SELECT ns.nspname AS seq_schema, s.relname AS seq_name, nt.nspname AS table_schema, t.relname AS table_name, a.attname AS column_name
    FROM pg_class s
    JOIN pg_namespace ns ON ns.oid = s.relnamespace
    JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a', 'i')
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_namespace nt ON nt.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
   WHERE s.relkind = 'S' AND ns.nspname IN ('public', 'drizzle')
   ORDER BY 1, 2`;

export function sequenceCoverageSql(seq) {
  return `SELECT (SELECT coalesce(max(${ident(seq.column_name)}), 0)::text FROM ${ident(seq.table_schema)}.${ident(seq.table_name)}) AS max_value,
                 (SELECT last_value::text FROM ${ident(seq.seq_schema)}.${ident(seq.seq_name)}) AS last_value`;
}

/**
 * Dozvole nad tabelama za sve uloge osim vlasnika objekta i sistemskih.
 *
 * Iz kataloga (`relacl`), NE iz `information_schema.role_table_grants`: taj
 * pogled prikazuje samo dozvole koje vidi TRENUTNA uloga, pa bi čitalac kopije
 * i administrator vraćanja dobili različite spiskove iste baze.
 */
export const GRANTS_SQL = `
  SELECT r.rolname AS grantee, n.nspname AS schema, c.relname AS name,
         string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type) AS privileges
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
    JOIN pg_roles r ON r.oid = a.grantee
   WHERE n.nspname IN ('public', 'drizzle') AND c.relkind IN ('r', 'p', 'v', 'm')
     AND a.grantee <> c.relowner AND r.rolname NOT LIKE 'pg\\_%'
   GROUP BY 1, 2, 3
   ORDER BY 1, 2, 3`;

export const MIGRATIONS_SQL = `
  SELECT count(*)::int AS count,
         (SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC, id DESC LIMIT 1) AS last_hash
    FROM drizzle.__drizzle_migrations`;

export const SALES_SQL = `
  SELECT extract(year FROM issued_on)::int AS year,
         count(DISTINCT invoice_id)::int AS invoices,
         count(*)::int AS lines,
         round(sum(line_amount) FILTER (WHERE enters_net), 2)::text AS net
    FROM effective_sales_ledger
   GROUP BY 1 ORDER BY 1`;

/**
 * Gradi manifest kroz prosleđenu funkciju `query(text) → rows`.
 * Pozivalac obezbeđuje da su svi upiti u istoj transakciji (snimku).
 *
 * @param {(text: string) => Promise<Record<string, any>[]>} query
 */
export async function buildManifest(query, { snapshot = null } = {}) {
  for (const s of SESSION_SETTINGS) await query(s);
  const [meta] = await query(`SELECT now() AS at, current_setting('server_version') AS server_version`);
  const tables = [];
  for (const t of await query(TABLES_SQL)) {
    const [r] = await query(tableChecksumSql(t.schema, t.name));
    tables.push({ schema: t.schema, name: t.name, rows: Number(r.rows), md5: r.md5 });
  }
  const [mig] = await query(MIGRATIONS_SQL);
  const sequences = (await query(SEQUENCES_SQL)).map((s) => ({ schema: s.schema, name: s.name, lastValue: String(s.last_value) }));
  const grants = (await query(GRANTS_SQL)).map((g) => ({ grantee: g.grantee, schema: g.schema, name: g.name, privileges: g.privileges }));
  const sales = (await query(SALES_SQL)).map((s) => ({ year: s.year, invoices: s.invoices, lines: s.lines, net: s.net }));
  return {
    version: MANIFEST_VERSION,
    createdAt: new Date(meta.at).toISOString(),
    serverVersion: meta.server_version,
    snapshot,
    migrations: { count: mig.count, lastHash: mig.last_hash },
    tables,
    sequences,
    grants,
    sales,
    totals: {
      tables: tables.length,
      rows: tables.reduce((s, t) => s + t.rows, 0),
      invoices: sales.reduce((s, y) => s + y.invoices, 0),
      lines: sales.reduce((s, y) => s + y.lines, 0),
      net: sales.reduce((s, y) => s + Math.round(Number(y.net ?? 0) * 100), 0) / 100,
    },
  };
}

/**
 * Poredi manifest izvora i vraćene baze. Vraća spisak razlika (prazan = isto).
 * Sekvence se NE porede po vrednosti: pg_dump ih čita van snimka (nisu
 * transakcione); njih proverava `sequenceCoverageSql` (sekvenca >= max kolone).
 */
export function compareManifests(source, restored) {
  const diffs = [];
  const key = (t) => `${t.schema}.${t.name}`;
  const a = new Map(source.tables.map((t) => [key(t), t]));
  const b = new Map(restored.tables.map((t) => [key(t), t]));
  for (const [k, t] of a) {
    const r = b.get(k);
    if (!r) diffs.push(`tabela ${k} nedostaje posle vraćanja`);
    else if (r.rows !== t.rows) diffs.push(`tabela ${k}: redova ${t.rows} → ${r.rows}`);
    else if (r.md5 !== t.md5) diffs.push(`tabela ${k}: sadržaj se razlikuje (kontrolni zbir)`);
  }
  for (const k of b.keys()) if (!a.has(k)) diffs.push(`tabela ${k} postoji samo posle vraćanja`);
  if (source.migrations.count !== restored.migrations.count || source.migrations.lastHash !== restored.migrations.lastHash) {
    diffs.push(`migracije: ${source.migrations.count} → ${restored.migrations.count}`);
  }
  const g = (x) => x.map((y) => `${y.grantee}|${y.schema}.${y.name}|${y.privileges}`).sort().join("\n");
  if (g(source.grants) !== g(restored.grants)) diffs.push("dozvole aplikacionih uloga se razlikuju");
  const s = (x) => JSON.stringify(x.sales);
  if (s(source) !== s(restored)) diffs.push("kontrolni zbirovi prodaje se razlikuju");
  const seqA = new Set(source.sequences.map((x) => `${x.schema}.${x.name}`));
  const seqB = new Set(restored.sequences.map((x) => `${x.schema}.${x.name}`));
  for (const k of seqA) if (!seqB.has(k)) diffs.push(`sekvenca ${k} nedostaje posle vraćanja`);
  return diffs;
}

/**
 * Kratak opis bez poslovnih iznosa — sme u nešifrovan status (artefakt,
 * tabela `backup_runs`). Zbirovi prodaje ostaju samo u šifrovanom manifestu.
 */
export function publicSummary(manifest) {
  return {
    version: manifest.version,
    createdAt: manifest.createdAt,
    serverVersion: manifest.serverVersion,
    migrations: manifest.migrations.count,
    tables: manifest.totals.tables,
    rows: manifest.totals.rows,
    sequences: manifest.sequences.length,
  };
}
