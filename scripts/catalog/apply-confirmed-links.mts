/**
 * Upis POTVRĐENIH veza BizniSoft artikal → katalog i potvrđenih pakovanja (dok. 61).
 *
 *   DATABASE_URL=<baza> npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/catalog/apply-confirmed-links.mts <plan.json> --potvrdio <email> [--upis | --povuci "<razlog>"]
 *
 * Plan (PRIVATAN, van repoa): { veze: [{ sifra, slug, varijanta|null, jm, pakovanje|null, oznaka, izvor? }], izvor }.
 * `slug: null` = samo potvrđeno pakovanje BEZ veze sa karticom (artikal bez kartice na sajtu, poručuje se kroz nalog).
 * Bez `--upis` samo proverava i ispisuje plan. Veza se upisuje kroz `decideMapping`
 * (isti put kao ekran Mapiranja: audit, istorija); pakovanje u `article_pack_sizes`.
 * `--ispravi-oznaku "<razlog>"` menja SAMO tekst oznake već upisanog pakovanja (npr. „kutija 250” → „BOX — kutija
 * 250”) kada se količina i JM tačno slažu sa planom; stara oznaka i razlog se dopisuju u dokaz, uz audit. Drugačija količina
 * ili JM se ovim ne menja (povratak `--povuci`, pa novi `--upis`).
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
const labelReason = arg("--ispravi-oznaku");
const write = rest.includes("--upis") || Boolean(revokeReason) || Boolean(labelReason);
if ([rest.includes("--upis"), Boolean(revokeReason), Boolean(labelReason)].filter(Boolean).length > 1) {
  console.error("--upis, --povuci i --ispravi-oznaku se ne kombinuju.");
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
const { AUDIT_ACTIONS, recordAudit } = await import("@/lib/audit/record");

/** `deo_kom`: izričit izuzetak vlasnika — pakovanje je deo jednog KOM (npr. 0,5). */
/** `jm_izvor`: izvorna JM portala koja se, po izričitoj potvrdi vlasnika, razlikuje od prodajne `jm` (izvor se ne menja). */
type Link = { sifra: string; slug: string | null; varijanta: string | null; jm: string; pakovanje: number | null; oznaka?: string; izvor?: string; deo_kom?: boolean; jm_izvor?: string };
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
  const packOnly = v.slug === null;
  const facts = packOnly ? null : catalogOfferFacts(v.slug, v.varijanta);
  const problems: string[] = [];
  if (!a) problems.push("artikal ne postoji u bazi");
  else {
    const unitOk = String(a.unit ?? "").toUpperCase() === v.jm.toUpperCase() || (v.jm_izvor && String(a.unit ?? "").toUpperCase() === v.jm_izvor.toUpperCase());
    if (!unitOk) problems.push(`JM u bazi ${a.unit} ≠ ${v.jm}`);
    if (a.out) problems.push("artikal je van programa");
    if (!packOnly && a.status === "mapped" && (a.slug !== v.slug || (a.variant ?? null) !== (v.varijanta ?? null))) problems.push(`već potvrđena DRUGA veza (${a.slug}${a.variant ? ` · ${a.variant}` : ""})`);
    if (a.status === "conflict") problems.push("veza je u statusu sukob");
  }
  if (facts && !facts.productExists) problems.push("kataloški proizvod ne postoji");
  else if (facts && v.varijanta && !facts.link?.variantKey) problems.push(`varijanta ${v.varijanta} nije pronađena u katalogu`);
  if (packOnly && v.pakovanje === null) problems.push("stavka bez veze mora imati pakovanje");
  if (v.pakovanje !== null) {
    const r = orderPack({ unit: v.jm, fractionalSales: a?.fractional, confirmed: { packQuantity: v.pakovanje, unit: v.jm, label: v.oznaka ?? "", fractionalOk: Boolean(v.deo_kom) } });
    if (r.status !== "pack") problems.push(`pakovanje: ${r.reason}`);
    if (!has) problems.push("pakovanje: 0047 nije primenjena");
    if (a?.pq && (Number(a.pq) !== Number(v.pakovanje) || a.pu !== v.jm.toUpperCase())) problems.push(`već postoji DRUGO pakovanje (${a.pq} ${a.pu})`);
  }
  const already = packOnly ? Boolean(a?.pq) : a?.status === "mapped" && a.slug === v.slug && (a.variant ?? null) === (v.varijanta ?? null);
  rows.push({ sifra: v.sifra, naziv: a?.name ?? "—", jm: v.jm, katalog: packOnly ? "(bez kartice — samo pakovanje)" : (facts?.link?.name ?? v.slug), varijanta: packOnly ? "—" : (facts?.link?.variantLabel ?? (v.varijanta ? "?" : "(proizvod)")), pakovanje: v.pakovanje === null ? "—" : `${v.pakovanje} ${v.jm} · ${v.oznaka ?? ""}`, stanje: problems.length ? `ODBIJENO: ${problems.join("; ")}` : already ? (packOnly ? "pakovanje već upisano" : "veza već potvrđena") : "spremno", _id: a?.id, _ok: !problems.length, _already: already, _v: v });
}
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")))));
const ready = rows.filter((r) => r._ok);
console.log(`Spremno: ${ready.length} / ${rows.length}${write ? "" : " — samo plan (bez --upis ništa nije upisano)"}`);
if (labelReason) {
  if (labelReason.trim().length < 5) { console.error("Razlog ispravke: najmanje 5 znakova."); process.exit(1); }
  let n = 0;
  for (const v of plan.veze) {
    if (v.pakovanje === null || !v.oznaka) continue;
    const [ps] = [...(await db.execute<{ article_id: string; pack_quantity: string; unit: string; label: string }>(sql`
      SELECT ps.article_id, ps.pack_quantity::text AS pack_quantity, ps.unit, ps.label
        FROM article_pack_sizes ps JOIN articles a ON a.id = ps.article_id WHERE a.code = ${v.sifra}`))];
    if (!ps) { console.log(`${v.sifra}: pakovanje nije upisano — preskočeno (koristite --upis).`); continue; }
    if (Number(ps.pack_quantity) !== Number(v.pakovanje) || ps.unit !== v.jm.toUpperCase()) {
      console.log(`${v.sifra}: ODBIJENO — upisano ${ps.pack_quantity} ${ps.unit}, plan ${v.pakovanje} ${v.jm}; količina se ne menja ovim režimom.`);
      continue;
    }
    if (ps.label === v.oznaka) continue;
    // Oznaka i audit u istoj transakciji; ponovljeno pokretanje ne menja ništa (oznaka je već nova).
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE article_pack_sizes
           SET label = ${v.oznaka},
               evidence = evidence || ${` · ${new Date().toISOString().slice(0, 10)} ispravka oznake („${ps.label}” → „${v.oznaka}”): ${labelReason.trim()} (${by})`}
         WHERE article_id = ${ps.article_id}::uuid`);
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role as never },
          action: AUDIT_ACTIONS.packLabelCorrected,
          entityType: "Artikal",
          entityId: ps.article_id,
          entityLabel: v.sifra,
          before: { oznaka: ps.label },
          after: { oznaka: v.oznaka, pakovanje: `${ps.pack_quantity} ${ps.unit}` },
          reason: `${labelReason.trim()}${v.izvor ? ` (${v.izvor})` : ""}`.slice(0, 1000),
        },
        tx as never,
      );
    });
    console.log(`${v.sifra}: „${ps.label}” → „${v.oznaka}”`);
    n += 1;
  }
  console.log(`Ispravljeno oznaka: ${n}.`);
  process.exit(0);
}
if (revokeReason) {
  if (revokeReason.trim().length < 5) { console.error("Razlog povlačenja: najmanje 5 znakova."); process.exit(1); }
  let n = 0;
  for (const r of rows) {
    const v = r._v as Link;
    if (!r._id) continue;
    if (r._already && v.slug !== null) {
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
    if (!r._already && v.slug !== null) {
      await decideMapping(
        { articleId: r._id as string, status: "mapped", catalogProductSlug: v.slug, catalogVariantId: v.varijanta, note: `${v.izvor ?? plan.izvor ?? "Potvrda vlasnika"} — ${v.sifra}` },
        actor,
      );
    }
    if (v.pakovanje !== null) {
      // Pakovanje i njegov audit u istoj transakciji; već upisano pakovanje se ne dira (ponovljeno pokretanje).
      await db.transaction(async (tx) => {
        const inserted = [...(await tx.execute<{ article_id: string }>(sql`
          INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by, fractional_ok)
          VALUES (${r._id as string}::uuid, ${v.pakovanje}, ${v.jm.toUpperCase()}, ${v.oznaka ?? `${v.pakovanje} ${v.jm}`}, ${v.izvor ?? plan.izvor ?? "potvrda vlasnika"}, ${actor.id}::uuid, ${Boolean(v.deo_kom)})
          ON CONFLICT (article_id) DO NOTHING
          RETURNING article_id`))];
        if (!inserted.length) return;
        await recordAudit(
          {
            actor: { id: actor.id, name: actor.name, role: actor.role as never },
            action: AUDIT_ACTIONS.packSizeConfirmed,
            entityType: "Artikal",
            entityId: r._id as string,
            entityLabel: `${v.sifra} ${String(r.naziv)}`.slice(0, 200),
            before: null,
            after: { pakovanje: v.pakovanje, jm: v.jm.toUpperCase(), oznaka: v.oznaka ?? null, deoKom: Boolean(v.deo_kom) },
            reason: `${v.izvor ?? plan.izvor ?? "Potvrda vlasnika"}`.slice(0, 1000),
          },
          tx as never,
        );
      });
    }
  }
  console.log(`Upisano: ${ready.length}.`);
}
process.exit(0);
