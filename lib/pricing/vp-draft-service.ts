import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { priceListDraftRows, priceListDrafts, priceListImportRows, priceListImports } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { readXlsxCells } from "@/lib/import/xlsx/readXlsx.mjs";
import { notify } from "@/lib/notifications/notification-service";
import { groupKeysFor } from "@/lib/pricing/rebateTable.mjs";
import { parseDraftSheet, planDraft, sanitizeEdits, type DraftEdits } from "@/lib/pricing/vpDraft.mjs";
import { brandOf } from "@/lib/procurement/suggest.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { isOutOfProgrammeBrand } from "@/lib/stock/lagerSearch.mjs";

/**
 * Priprema novog VP cenovnika (0066; odluka vlasnika 2026-11-18).
 *
 *   menadžer prodaje (`pricelist:prepare`)  — pravi pripremu: procenti po brendu/grupi/artiklu,
 *                                              tačne cene, ili Excel; šalje kancelariji;
 *   kancelarija (`pricelist:office_check`)  — stara pored nove, Excel za BizniSoft; šalje
 *                                              vlasniku ili vraća na doradu;
 *   vlasnik (`pricelist:manage`)            — primena postojećim putem (otpremanje cenovnika,
 *                                              drugi faktor, datum važenja).
 *
 * Nova cena se uvek RAČUNA NA SERVERU iz važećih cena i unosa — iznos iz pregledača se ne
 * upisuje. Ništa ovde ne menja osnovnu cenu.
 */

export class VpDraftError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VpDraftError";
  }
}

type Actor = Pick<PortalUser, "id" | "name" | "role"> & { permissions?: readonly string[] };
const ENTITY = "Priprema VP cenovnika";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toCents = (v: string | number) => Math.round(Number(v) * 100);
const dec = (cents: number) => (cents / 100).toFixed(2);
const auditActor = (a: Actor) => ({ id: a.id, name: a.name, role: a.role });

function need(actor: Actor, capability: string, message: string) {
  if (!can(actor as PortalUser, capability)) throw new VpDraftError("forbidden", message);
}

export type VpBaseRow = {
  articleId: string;
  code: string;
  name: string;
  unit: string | null;
  brand: string;
  group: string;
  vatPercent: number;
  /** Važeća osnovna VP cena (bez PDV-a) u parama; null = artikal još nema cenu. */
  oldCents: number | null;
};

/**
 * Važeći VP cenovnik na dan: artikli u programu, sa poslednjom osnovnom cenom (ili bez nje kada
 * `withUnpriced`). Raspored brend › grupa › naziv kao u tabeli rabata.
 */
export async function loadCurrentVp(onDate: string = belgradeDate(new Date()), withUnpriced = false): Promise<VpBaseRow[]> {
  if (!ISO.test(onDate)) throw new VpDraftError("datum", "Neispravan datum.");
  const rows = await getDb().execute<{ id: string; code: string; name: string; brand: string | null; unit: string | null; price: string | null; vat: string | null }>(sql`
    SELECT a.id, a.code, a.name, a.brand, a.unit, b.net_price::text AS price, b.vat_percent::text AS vat
      FROM articles a
      LEFT JOIN LATERAL (
        SELECT net_price, vat_percent FROM article_base_prices p
         WHERE p.article_id = a.id AND p.valid_from <= ${onDate}::date
         ORDER BY p.valid_from DESC, p.created_at DESC LIMIT 1) b ON true
     WHERE NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       ${withUnpriced ? sql`` : sql`AND b.net_price IS NOT NULL`}`);
  return [...rows]
    // 3M i sia su van programa i kada im šifra nije označena (isto kao Lager lista).
    .filter((a) => !isOutOfProgrammeBrand(a))
    .map((a) => {
      const keys = groupKeysFor({ name: a.name, brand: a.brand });
      return {
        articleId: a.id,
        code: a.code,
        name: a.name,
        unit: a.unit,
        brand: brandOf(a.name, a.brand),
        group: keys.group,
        vatPercent: a.vat === null ? 20 : Number(a.vat),
        oldCents: a.price === null ? null : toCents(a.price),
      };
    })
    .sort((x, y) => x.brand.localeCompare(y.brand, "sr") || x.group.localeCompare(y.group, "sr") || x.name.localeCompare(y.name, "sr"));
}

/* =========================================================================
 * Čitanje
 * ====================================================================== */

export type VpDraftListItem = {
  id: string;
  title: string;
  origin: string;
  stage: string;
  importStatus: string | null;
  importValidFrom: string | null;
  changedCount: number;
  createdBy: string;
  updatedAt: Date;
  proposedValidFrom: string | null;
};

export async function listVpDrafts(actor: Actor, limit = 50): Promise<VpDraftListItem[]> {
  need(actor, "view:vp_cenovnik", "Nemate pristup VP cenovniku.");
  const rows = await getDb().execute<{
    id: string; title: string; origin: string; stage: string; import_status: string | null; import_valid_from: string | null;
    changed_count: number; created_by: string; updated_at: string; proposed_valid_from: string | null;
  }>(sql`
    SELECT d.id, d.title, d.origin, d.stage, i.status::text AS import_status, i.valid_from::text AS import_valid_from,
           d.changed_count, u.name AS created_by, d.updated_at, d.proposed_valid_from::text AS proposed_valid_from
      FROM price_list_drafts d
      JOIN users u ON u.id = d.created_by
      LEFT JOIN price_list_imports i ON i.id = d.import_id
     ORDER BY (d.stage = 'odbaceno'), d.updated_at DESC
     LIMIT ${limit}`);
  return [...rows].map((r) => ({
    id: r.id,
    title: r.title,
    origin: r.origin,
    stage: r.stage,
    importStatus: r.import_status,
    importValidFrom: r.import_valid_from,
    changedCount: Number(r.changed_count),
    createdBy: r.created_by,
    updatedAt: new Date(r.updated_at),
    proposedValidFrom: r.proposed_valid_from,
  }));
}

export type VpDraftRow = {
  articleId: string;
  code: string;
  name: string;
  brand: string;
  group: string;
  vatPercent: number;
  oldCents: number | null;
  newCents: number;
  /** Važeća cena DANAS (može se razlikovati od stare ako je u međuvremenu primenjen drugi cenovnik). */
  currentCents: number | null;
};

export async function loadVpDraft(actor: Actor, id: string) {
  need(actor, "view:vp_cenovnik", "Nemate pristup VP cenovniku.");
  if (!UUID.test(id)) return null;
  const db = getDb();
  const [draft] = [
    ...(await db.execute<{
      id: string; title: string; origin: string; stage: string; proposed_valid_from: string | null; prepared_note: string | null;
      edits: unknown; rounding: string; created_by: string; created_by_name: string; created_at: string; updated_at: string;
      sent_to_office_at: string | null; sent_to_office_name: string | null; office_checked_at: string | null; office_checked_name: string | null;
      office_note: string | null; returned_at: string | null; returned_name: string | null; returned_note: string | null;
      import_id: string | null; import_status: string | null; import_valid_from: string | null; import_decision_note: string | null; row_count: number; changed_count: number;
    }>(sql`
      SELECT d.id, d.title, d.origin, d.stage, d.proposed_valid_from::text AS proposed_valid_from, d.prepared_note, d.edits, d.rounding,
             d.created_by, cu.name AS created_by_name, d.created_at, d.updated_at,
             d.sent_to_office_at, su.name AS sent_to_office_name, d.office_checked_at, ou.name AS office_checked_name, d.office_note,
             d.returned_at, ru.name AS returned_name, d.returned_note,
             d.import_id, i.status::text AS import_status, i.valid_from::text AS import_valid_from, i.decision_note AS import_decision_note,
             d.row_count, d.changed_count
        FROM price_list_drafts d
        JOIN users cu ON cu.id = d.created_by
        LEFT JOIN users su ON su.id = d.sent_to_office_by
        LEFT JOIN users ou ON ou.id = d.office_checked_by
        LEFT JOIN users ru ON ru.id = d.returned_by
        LEFT JOIN price_list_imports i ON i.id = d.import_id
       WHERE d.id = ${id}::uuid`)),
  ];
  if (!draft) return null;
  const today = belgradeDate(new Date());
  const rows = await db.execute<{ article_id: string; code: string; name: string; brand: string; group_key: string; vat: string; old: string | null; new: string; current: string | null }>(sql`
    SELECT r.article_id, r.code, r.name, r.brand, r.group_key, r.vat_percent::text AS vat, r.old_vp_price::text AS old, r.new_vp_price::text AS new,
           (SELECT p.net_price::text FROM article_base_prices p WHERE p.article_id = r.article_id AND p.valid_from <= ${today}::date
             ORDER BY p.valid_from DESC, p.created_at DESC LIMIT 1) AS current
      FROM price_list_draft_rows r
     WHERE r.draft_id = ${id}::uuid
     ORDER BY r.brand, r.group_key, r.name`);
  const list: VpDraftRow[] = [...rows].map((r) => ({
    articleId: r.article_id,
    code: r.code,
    name: r.name,
    brand: r.brand,
    group: r.group_key,
    vatPercent: Number(r.vat),
    oldCents: r.old === null ? null : toCents(r.old),
    newCents: toCents(r.new),
    currentCents: r.current === null ? null : toCents(r.current),
  }));
  return { draft: { ...draft, edits: sanitizeEdits(draft.edits) }, rows: list, today };
}

/* =========================================================================
 * Priprema (menadžer prodaje)
 * ====================================================================== */

type SaveInput = {
  id?: string | null;
  title: string;
  proposedValidFrom?: string | null;
  note?: string | null;
  edits: unknown;
  rounding?: string | null;
  origin?: "priprema" | "excel";
};

function cleanTitle(t: string) {
  const s = String(t ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (s.length < 3) throw new VpDraftError("naziv", "Upišite naziv pripreme (npr. „R-M +4 % od 1.12.“).");
  return s;
}

/** Čuva pripremu: nove cene se računaju ovde, iz važećih cena i unosa. Vraća ID i broj promena. */
export async function saveVpDraft(actor: Actor, input: SaveInput) {
  need(actor, "pricelist:prepare", "Pripremu cenovnika pravi menadžer prodaje ili vlasnik.");
  const title = cleanTitle(input.title);
  const proposed = input.proposedValidFrom && ISO.test(input.proposedValidFrom) ? input.proposedValidFrom : null;
  const note = input.note?.trim().slice(0, 1000) || null;
  const rounding = input.rounding === "dinar" ? "dinar" : "para";
  const edits: DraftEdits = sanitizeEdits(input.edits);
  const today = belgradeDate(new Date());
  const base = await loadCurrentVp(today, Object.keys(edits.prices ?? {}).length > 0);
  const byId = new Map(base.map((r) => [r.articleId, r]));
  // Tačna cena samo za artikle koji postoje u programu.
  for (const k of Object.keys(edits.prices ?? {})) if (!byId.has(k)) delete edits.prices![k];
  const plan = planDraft(base, edits, rounding);
  const pricedCount = base.filter((r) => r.oldCents !== null).length;

  return getDb().transaction(async (tx) => {
    let id = input.id && UUID.test(input.id) ? input.id : null;
    if (id) {
      const locked = [...(await tx.execute<{ stage: string }>(sql`SELECT stage FROM price_list_drafts WHERE id = ${id}::uuid FOR UPDATE`))][0];
      if (!locked) throw new VpDraftError("nema", "Priprema ne postoji.");
      if (locked.stage !== "priprema") throw new VpDraftError("korak", "Priprema je već poslata — menja se tek kada je kancelarija vrati.");
      await tx.execute(sql`
        UPDATE price_list_drafts SET title = ${title}, proposed_valid_from = ${proposed}, prepared_note = ${note}, edits = ${JSON.stringify(edits)}::jsonb,
               rounding = ${rounding}, updated_at = now(), row_count = ${pricedCount}, changed_count = ${plan.items.length}
         WHERE id = ${id}::uuid`);
      await tx.delete(priceListDraftRows).where(sql`${priceListDraftRows.draftId} = ${id}::uuid`);
    } else {
      const [created] = await tx
        .insert(priceListDrafts)
        .values({
          title,
          origin: input.origin ?? "priprema",
          proposedValidFrom: proposed,
          preparedNote: note,
          edits,
          rounding,
          createdBy: actor.id,
          rowCount: Math.max(pricedCount, plan.items.length),
          changedCount: plan.items.length,
        })
        .returning({ id: priceListDrafts.id });
      id = created.id;
    }
    for (let i = 0; i < plan.items.length; i += 500) {
      await tx.insert(priceListDraftRows).values(
        plan.items.slice(i, i + 500).map((it) => {
          const r = byId.get(it.articleId)!;
          return {
            draftId: id!,
            articleId: it.articleId,
            code: r.code,
            name: r.name.slice(0, 300),
            brand: r.brand,
            groupKey: r.group,
            vatPercent: String(r.vatPercent),
            oldVpPrice: it.oldCents === null ? null : dec(it.oldCents),
            newVpPrice: dec(it.newCents),
          };
        }),
      );
    }
    if (input.id) {
      // `row_count` ≥ `changed_count` (ograničenje); artikli bez stare cene mogu biti iznad broja cena.
      await tx.execute(sql`UPDATE price_list_drafts SET row_count = greatest(row_count, changed_count) WHERE id = ${id}::uuid`);
    }
    await recordAudit(
      {
        actor: auditActor(actor),
        action: AUDIT_ACTIONS.priceDraftSaved,
        entityType: ENTITY,
        entityId: id!,
        entityLabel: title,
        after: { changed: plan.items.length, ignored: plan.ignored.length, rounding, proposedValidFrom: proposed, brands: edits.brands, groups: edits.groups, articles: Object.keys(edits.articles ?? {}).length, prices: Object.keys(edits.prices ?? {}).length },
      },
      tx,
    );
    return { id: id!, changed: plan.items.length, ignored: plan.ignored.length };
  });
}

/**
 * Excel → nova priprema. Šifra mora postojati u portalu i biti u programu; nepoznate šifre i
 * neispravni redovi se vraćaju kao spisak (ništa se ne pogađa po nazivu).
 */
export async function createVpDraftFromExcel(actor: Actor, input: { fileName: string; bytes: Uint8Array; title?: string | null }) {
  need(actor, "pricelist:prepare", "Pripremu cenovnika pravi menadžer prodaje ili vlasnik.");
  let sheets;
  try {
    sheets = readXlsxCells(Buffer.from(input.bytes));
  } catch {
    throw new VpDraftError("format", "Fajl nije ispravan .xlsx. Sačuvajte ga u Excelu kao „Excel radna sveska (.xlsx)“.");
  }
  const sheet = sheets[0]?.rows ?? [];
  const parsed = parseDraftSheet(sheet);
  if (!parsed.ok) throw new VpDraftError("format", parsed.error);
  const base = await loadCurrentVp(belgradeDate(new Date()), true);
  const byCode = new Map(base.map((r) => [r.code, r]));
  const prices: Record<string, number> = {};
  const problems = [...parsed.problems];
  for (const r of parsed.rows) {
    const a = byCode.get(r.code);
    if (!a) problems.push({ line: r.line, text: `${r.code}: šifra ne postoji u portalu ili je artikal van programa` });
    else if (a.oldCents !== r.cents) prices[a.articleId] = r.cents;
  }
  if (!Object.keys(prices).length) {
    throw new VpDraftError("prazno", problems.length ? `Nijedna cena nije promenjena. Problemi: ${problems.slice(0, 5).map((p) => `red ${p.line}: ${p.text}`).join("; ")}` : "U fajlu nema nijedne nove cene (kolona „Nova VP“ je prazna ili su cene iste kao važeće).");
  }
  const title = input.title?.trim() || `Excel: ${input.fileName.replace(/\.xlsx$/i, "")}`.slice(0, 120);
  const saved = await saveVpDraft(actor, { title, edits: { prices }, origin: "excel", note: problems.length ? `Iz Excela „${input.fileName.slice(0, 80)}“ nije uzeto ${problems.length} redova: ${problems.slice(0, 20).map((p) => `red ${p.line} — ${p.text}`).join("; ")}`.slice(0, 1000) : null });
  return { ...saved, problems };
}

async function stageNotice(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  input: { capability: string; title: string; body: string; id: string },
) {
  await notify(
    {
      kind: "price_list_stage",
      requiredCapability: input.capability,
      title: input.title,
      body: input.body,
      entityType: ENTITY,
      entityId: input.id,
      actionHref: `/portal/vp-cenovnik/${input.id}`,
    },
    tx,
  );
}

async function lockDraft(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], id: string) {
  if (!UUID.test(id)) throw new VpDraftError("nema", "Priprema ne postoji.");
  const d = [...(await tx.execute<{ id: string; title: string; stage: string; changed_count: number; created_by: string }>(sql`
    SELECT id, title, stage, changed_count, created_by FROM price_list_drafts WHERE id = ${id}::uuid FOR UPDATE`))][0];
  if (!d) throw new VpDraftError("nema", "Priprema ne postoji.");
  return d;
}

export async function sendVpDraftToOffice(actor: Actor, id: string, note?: string | null) {
  need(actor, "pricelist:prepare", "Pripremu šalje menadžer prodaje ili vlasnik.");
  return getDb().transaction(async (tx) => {
    const d = await lockDraft(tx, id);
    if (d.stage !== "priprema") throw new VpDraftError("korak", "Priprema je već poslata.");
    if (Number(d.changed_count) === 0) throw new VpDraftError("prazno", "U pripremi nema nijedne promene cene.");
    const n = note?.trim().slice(0, 1000) || null;
    await tx.execute(sql`
      UPDATE price_list_drafts SET stage = 'kancelarija', sent_to_office_by = ${actor.id}::uuid, sent_to_office_at = now(), updated_at = now(),
             prepared_note = coalesce(${n}, prepared_note)
       WHERE id = ${id}::uuid`);
    await stageNotice(tx, {
      capability: "pricelist:office_check",
      title: `Nov VP cenovnik za proveru: ${d.title}`,
      body: `${actor.name} je poslao pripremu (${d.changed_count} promenjenih cena). Proverite staru i novu cenu, preuzmite Excel za BizniSoft i pošaljite vlasniku.`,
      id,
    });
    await recordAudit({ actor: auditActor(actor), action: AUDIT_ACTIONS.priceDraftSentToOffice, entityType: ENTITY, entityId: id, entityLabel: d.title, after: { changed: Number(d.changed_count) }, reason: n }, tx);
  });
}

export async function returnVpDraft(actor: Actor, id: string, note: string) {
  const n = String(note ?? "").trim();
  if (n.length < 5) throw new VpDraftError("razlog", "Napišite šta treba ispraviti (bar 5 znakova).");
  return getDb().transaction(async (tx) => {
    const d = await lockDraft(tx, id);
    if (d.stage === "kancelarija") need(actor, "pricelist:office_check", "Pripremu vraća kancelarija ili vlasnik.");
    else if (d.stage !== "priprema") throw new VpDraftError("korak", "Pripremu kod vlasnika vraća vlasnik odbacivanjem cenovnika.");
    else throw new VpDraftError("korak", "Priprema je već na doradi.");
    await tx.execute(sql`
      UPDATE price_list_drafts SET stage = 'priprema', returned_by = ${actor.id}::uuid, returned_at = now(), returned_note = ${n.slice(0, 1000)}, updated_at = now()
       WHERE id = ${id}::uuid`);
    await stageNotice(tx, {
      capability: "pricelist:prepare",
      title: `VP cenovnik vraćen na doradu: ${d.title}`,
      body: `${actor.name}: ${n.slice(0, 300)}`,
      id,
    });
    await recordAudit({ actor: auditActor(actor), action: AUDIT_ACTIONS.priceDraftReturned, entityType: ENTITY, entityId: id, entityLabel: d.title, reason: n.slice(0, 500) }, tx);
  });
}

/**
 * Kancelarija proverila → otpremanje cenovnika (status „pregled“) sa SAMO promenjenim cenama.
 * Primena ide postojećim putem kod vlasnika (drugi faktor, datum važenja).
 */
export async function sendVpDraftToOwner(actor: Actor, id: string, note?: string | null) {
  need(actor, "pricelist:office_check", "Vlasniku šalje kancelarija posle provere.");
  return getDb().transaction(async (tx) => {
    const d = await lockDraft(tx, id);
    if (d.stage !== "kancelarija") throw new VpDraftError("korak", "Vlasniku se šalje priprema koju je kancelarija proverila.");
    const rows = [...(await tx.execute<{ code: string; name: string; vat: string; new: string }>(sql`
      SELECT code, name, vat_percent::text AS vat, new_vp_price::text AS new FROM price_list_draft_rows WHERE draft_id = ${id}::uuid ORDER BY brand, group_key, name`))];
    if (!rows.length) throw new VpDraftError("prazno", "U pripremi nema nijedne promene cene.");
    const today = belgradeDate(new Date());
    const n = note?.trim().slice(0, 1000) || null;
    const payload = JSON.stringify(rows);
    const [imp] = await tx
      .insert(priceListImports)
      .values({
        fileSha256: createHash("sha256").update(`priprema:${id}:${randomUUID()}:${payload}`).digest("hex"),
        fileName: `Priprema — ${d.title}`.slice(0, 200),
        fileBytes: Buffer.byteLength(payload),
        parserVersion: "priprema-v1",
        reportTitle: `Priprema VP cenovnika — ${d.title}`.slice(0, 300),
        reportDate: today,
        pageCount: 1,
        rowCount: rows.length,
        checks: { totalVpMatches: true, rowChecksFailed: 0, origin: "priprema", draftId: id },
        problems: [],
        uploadedBy: actor.id,
      })
      .returning({ id: priceListImports.id });
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(priceListImportRows).values(
        rows.slice(i, i + 500).map((r, j) => ({ importId: imp.id, lineNo: i + j + 1, code: r.code, name: r.name, vatPercent: r.vat, vpPrice: r.new, page: 1 })),
      );
    }
    await tx.execute(sql`
      UPDATE price_list_drafts SET stage = 'vlasnik', import_id = ${imp.id}::uuid, office_checked_by = ${actor.id}::uuid, office_checked_at = now(),
             office_note = ${n}, updated_at = now()
       WHERE id = ${id}::uuid`);
    await notify(
      {
        kind: "price_list_stage",
        requiredCapability: "pricelist:manage",
        title: `VP cenovnik čeka Vašu potvrdu: ${d.title}`,
        body: `${actor.name} je proverila pripremu (${rows.length} promenjenih cena). Izaberite datum važenja i potvrdite.`,
        entityType: ENTITY,
        entityId: id,
        actionHref: `/portal/cene/cenovnik/${imp.id}`,
      },
      tx,
    );
    await recordAudit(
      { actor: auditActor(actor), action: AUDIT_ACTIONS.priceDraftSentToOwner, entityType: ENTITY, entityId: id, entityLabel: d.title, after: { importId: imp.id, rows: rows.length }, reason: n },
      tx,
    );
    return { importId: imp.id };
  });
}

export async function discardVpDraft(actor: Actor, id: string) {
  need(actor, "pricelist:prepare", "Pripremu odbacuje menadžer prodaje ili vlasnik.");
  return getDb().transaction(async (tx) => {
    const d = await lockDraft(tx, id);
    if (d.stage !== "priprema") throw new VpDraftError("korak", "Odbacuje se samo priprema koja nije poslata.");
    await tx.execute(sql`UPDATE price_list_drafts SET stage = 'odbaceno', updated_at = now() WHERE id = ${id}::uuid`);
    await recordAudit({ actor: auditActor(actor), action: AUDIT_ACTIONS.priceDraftDiscarded, entityType: ENTITY, entityId: id, entityLabel: d.title }, tx);
  });
}

/** Priprema iz koje je nastalo otpremanje (za stranu vlasnika i obaveštenje posle odluke). */
export async function draftForImport(importId: string) {
  if (!UUID.test(importId)) return null;
  const [d] = [
    ...(await getDb().execute<{ id: string; title: string; created_by_name: string; office_checked_name: string | null; office_note: string | null; proposed_valid_from: string | null; prepared_note: string | null }>(sql`
      SELECT d.id, d.title, cu.name AS created_by_name, ou.name AS office_checked_name, d.office_note, d.proposed_valid_from::text AS proposed_valid_from, d.prepared_note
        FROM price_list_drafts d JOIN users cu ON cu.id = d.created_by LEFT JOIN users ou ON ou.id = d.office_checked_by
       WHERE d.import_id = ${importId}::uuid`)),
  ];
  return d ?? null;
}

/**
 * Posle odluke vlasnika: obaveštenje onome ko je pripremio i kancelariji. Kada vlasnik odbaci
 * cenovnik iz pripreme, priprema se vraća na doradu sa njegovim razlogom (otpremanje ostaje
 * odbačeno u istoriji Cenovnika).
 */
export async function afterOwnerDecision(actor: Actor, importId: string, decision: { applied: boolean; validFrom?: string | null; note?: string | null }) {
  const d = await draftForImport(importId);
  if (!d) return;
  const title = decision.applied ? `VP cenovnik primenjen: ${d.title}` : `VP cenovnik vraćen na doradu: ${d.title}`;
  const body = decision.applied
    ? `Vlasnik je potvrdio nove VP cene; važe od ${decision.validFrom ?? "—"}.`
    : `Vlasnik nije prihvatio cenovnik${decision.note ? `: ${decision.note.slice(0, 300)}` : "."} Priprema je ponovo u radu.`;
  await getDb().transaction(async (tx) => {
    if (!decision.applied) {
      await tx.execute(sql`
        UPDATE price_list_drafts SET stage = 'priprema', import_id = NULL, returned_by = ${actor.id}::uuid, returned_at = now(),
               returned_note = ${`Vlasnik: ${decision.note ?? ""}`.slice(0, 1000)}, updated_at = now()
         WHERE id = ${d.id}::uuid AND stage = 'vlasnik'`);
      await recordAudit({ actor: auditActor(actor), action: AUDIT_ACTIONS.priceDraftReturned, entityType: ENTITY, entityId: d.id, entityLabel: d.title, reason: decision.note?.slice(0, 500) ?? null }, tx);
    }
    for (const capability of ["pricelist:prepare", "pricelist:office_check"]) {
      await notify({ kind: "price_list_stage", requiredCapability: capability, title, body, entityType: ENTITY, entityId: d.id, actionHref: `/portal/vp-cenovnik/${d.id}` }, tx);
    }
  });
}
