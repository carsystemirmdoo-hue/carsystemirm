/**
 * Upis interne evidencije opreme (0054): „Oprema — izdaje se na revers“ (potvrda vlasnika 16. 10. 2026).
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-equipment.mts <plan.json> [--potvrdio <email> --upis [--production-odobreno]]
 *
 * Plan (PRIVATAN): { izvor, oprema: [{ sifra, naziv, jm: string | null, napomena? }] } — šifra TAČNO kako je
 * u BizniSoftu (tekst, vodeće nule). JM se ne izmišlja: null = podatak za dopunu. Bez `--upis` samo proverava
 * (sesija samo za čitanje). Već upisana šifra se ne menja, osim DOPUNE JM: prazna (NULL) JM dobija potvrđenu
 * vrednost iz plana; upisana JM se nikad ne prepisuje. Svaki upis ima audit u istoj transakciji.
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
const { codeKey } = await import("@/lib/stock/stockLink.mjs");

type Item = { sifra: string; naziv: string; jm: string | null; napomena?: string };
const plan = JSON.parse(readFileSync(planPath, "utf8")) as { izvor: string; oprema: Item[] };
const db = getDb();
if (!write) await db.execute(sql`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
const [actor] = by ? [...(await db.execute<{ id: string; name: string; role: string }>(sql`SELECT id, name, role::text AS role FROM users WHERE lower(email) = lower(${by}) AND active`))] : [];
if (write && !actor) { console.error(`Nema aktivnog zaposlenog ${by}.`); process.exit(1); }

const rows: Record<string, unknown>[] = [];
for (const v of plan.oprema) {
  const key = codeKey(v.sifra);
  const problems: string[] = [];
  if (!/^[0-9A-Za-z][0-9A-Za-z./-]{0,39}$/.test(v.sifra)) problems.push("šifra nije ispravna");
  if (v.jm !== null && !/^[A-ZČĆŠŽĐ]{1,5}$/.test(v.jm)) problems.push(`JM „${v.jm}“ nije ispravna`);
  const [existing] = [...(await db.execute<{ code: string; unit: string | null }>(sql`SELECT code, unit FROM internal_equipment WHERE code_key = ${key}`))];
  const fillUnit = Boolean(existing && existing.unit === null && v.jm);
  if (existing && existing.unit !== null && v.jm !== null && existing.unit !== v.jm) problems.push(`upisana JM je ${existing.unit} — ne prepisuje se`);
  const [art] = [...(await db.execute<{ code: string; mapped: boolean; pack: boolean }>(sql`
    SELECT a.code,
           EXISTS (SELECT 1 FROM article_catalog_mappings m WHERE m.article_id = a.id AND m.status = 'mapped') AS mapped,
           EXISTS (SELECT 1 FROM article_pack_sizes p WHERE p.article_id = a.id) AS pack
      FROM articles a WHERE regexp_replace(a.code, '^0+(?=[0-9])', '') = ${key}`))];
  if (art?.pack) problems.push("artikal ima potvrđeno prodajno pakovanje — proveriti pre klasifikacije");
  rows.push({ sifra: v.sifra, naziv: v.naziv, jm: v.jm ?? "(dopuniti)", u_portalu: art ? (art.mapped ? "da, sa vezom" : "da") : "ne", stanje: problems.length ? `ODBIJENO: ${problems.join("; ")}` : fillUnit ? `dopuna JM → ${v.jm}` : existing ? "već upisano" : "spremno", _ok: !problems.length, _new: !existing, _fill: fillUnit, _v: v, _key: key });
}
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")))));
const ready = rows.filter((r) => r._ok && r._new);
const fills = rows.filter((r) => r._ok && r._fill);
console.log(`Spremno: ${rows.filter((r) => r._ok).length} / ${rows.length}, novih ${ready.length}, dopuna JM ${fills.length}${write ? "" : " — samo plan"}`);
if (write) {
  for (const r of ready) {
    const v = r._v as Item;
    await db.transaction(async (tx) => {
      const ins = [...(await tx.execute<{ code: string }>(sql`
        INSERT INTO internal_equipment (code, code_key, name, unit, classification, evidence, note, decided_by)
        VALUES (${v.sifra}, ${r._key as string}, ${v.naziv}, ${v.jm}, 'oprema_revers', ${plan.izvor}, ${v.napomena ?? null}, ${actor.id}::uuid)
        ON CONFLICT DO NOTHING RETURNING code`))];
      if (!ins.length) return;
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role as never },
          action: AUDIT_ACTIONS.equipmentClassified,
          entityType: "Oprema",
          entityId: v.sifra,
          entityLabel: `${v.sifra} ${v.naziv}`.slice(0, 200),
          before: null,
          after: { klasifikacija: "oprema_revers", jm: v.jm, napomena: v.napomena ?? null },
          reason: plan.izvor.slice(0, 1000),
        },
        tx as never,
      );
    });
  }
  for (const r of fills) {
    const v = r._v as Item;
    await db.transaction(async (tx) => {
      // Samo prazna JM; ponovljeno pokretanje ne menja ništa (WHERE unit IS NULL).
      const upd = [...(await tx.execute<{ code: string }>(sql`
        UPDATE internal_equipment SET unit = ${v.jm} WHERE code_key = ${r._key as string} AND unit IS NULL RETURNING code`))];
      if (!upd.length) return;
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role as never },
          action: AUDIT_ACTIONS.equipmentUnitSet,
          entityType: "Oprema",
          entityId: upd[0].code,
          entityLabel: `${upd[0].code} ${v.naziv}`.slice(0, 200),
          before: { jm: null },
          after: { jm: v.jm },
          reason: (v.napomena ? `${plan.izvor} — ${v.napomena}` : plan.izvor).slice(0, 1000),
        },
        tx as never,
      );
    });
  }
  console.log(`Upisano: ${ready.length}, dopunjena JM: ${fills.length}.`);
}
process.exit(0);
