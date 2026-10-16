import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { articleBasePrices, articles, priceListImportRows, priceListImports, users } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { classifyPriceRows, rowsToApply, summarizeClassification } from "@/lib/pricing/priceListMatch.mjs";
import { evaluatePricing, netPriceFrom } from "@/lib/pricing/precedence.mjs";
import { centsToDecimal } from "@/lib/pricing/stockPriceReport.mjs";
import { readStockPriceReport } from "@/lib/pricing/stockReportPdf.mjs";
import { ACTIVE_RULE_STATUSES } from "@/lib/pricing/evaluation-service";

/**
 * Cenovnik: otpremanje → pregled → odluka gazde → osnovne cene.
 *
 * Granice odgovornosti:
 *  - ovde se menja SAMO osnovna cena artikla (`article_base_prices`);
 *  - rabati kupaca (`price_rules`) i istorijske fakture se ne diraju;
 *  - konačna cena se izračunava iz osnovne cene i rabata na dati dan.
 *
 * Uvoz (otpremanje, pregled, primena, odbacivanje) proverava `pricelist:import` (gazda i kancelarija);
 * ručna izmena osnovne cene `pricelist:manage` (samo gazda). Skriveno dugme nije ovlašćenje; akcija u `app/` dodaje svežu MFA potvrdu za upis.
 */

export class PriceListError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PriceListError";
  }
}

type Actor = Pick<PortalUser, "id" | "name" | "role"> & { permissions?: readonly string[] };

function assertOwner(actor: Actor) {
  if (!can(actor as PortalUser, "pricelist:manage")) {
    throw new PriceListError("forbidden", "Cenovnikom upravlja samo vlasnik.");
  }
}

/** Uvoz VP cenovnika (0057): gazda i kancelarija. Ručna izmena pojedinačne osnovne cene ostaje samo gazdi. */
function assertImporter(actor: Actor) {
  if (!can(actor as PortalUser, "pricelist:import") && !can(actor as PortalUser, "pricelist:manage")) {
    throw new PriceListError("forbidden", "Uvoz VP cenovnika rade vlasnik i kancelarija.");
  }
}

const ENTITY = "Cenovnik";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toCents = (v: string | number) => Math.round(Number(v) * 100);

/* =========================================================================
 * Otpremanje
 * ====================================================================== */

export type UploadResult = { importId: string; duplicate: boolean; rows: number; problems: number };

/** PDF → pročitan izveštaj → upis za pregled. Strukturna greška baca PriceListError (ništa se ne upisuje). */
export async function uploadPriceList(actor: Actor, input: { fileName: string; bytes: Uint8Array }): Promise<UploadResult> {
  assertImporter(actor);
  let report;
  try {
    report = await readStockPriceReport(input.bytes);
  } catch (error) {
    const e = error as { name?: string; code?: string; message?: string };
    if (e?.name === "StockReportFormatError") throw new PriceListError(`format_${e.code}`, e.message ?? "Nepoznat format.");
    throw error;
  }
  return recordPriceListReport(actor, { fileName: input.fileName, report });
}

type ParsedReport = Awaited<ReturnType<typeof readStockPriceReport>>;

/** Upis već pročitanog izveštaja (odvojeno radi testova). Isti SHA-256 vraća postojeće otpremanje. */
/** Dodatni podaci uvoza iz tabele (0057): format, jedinica cene, izbor kolona i izvorna cena reda. */
type TableExtras = {
  sourceFormat: "tabela";
  priceUnit: "jm" | "pak";
  columnMap: Record<string, unknown>;
  rows: { rawCents: number; fileUnit: string | null; filePack: string | null }[];
};

export async function recordPriceListReport(actor: Actor, input: { fileName: string; report: ParsedReport; table?: TableExtras }): Promise<UploadResult> {
  assertImporter(actor);
  const r = input.report;
  const db = getDb();
  const [existing] = await db
    .select({ id: priceListImports.id, rows: priceListImports.rowCount })
    .from(priceListImports)
    .where(eq(priceListImports.fileSha256, r.sha256))
    .limit(1);
  if (existing) return { importId: existing.id, duplicate: true, rows: existing.rows, problems: 0 };

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(priceListImports)
      .values({
        fileSha256: r.sha256,
        fileName: input.fileName.replace(/[\\/]/g, "_").slice(0, 200) || "cenovnik.pdf",
        fileBytes: r.bytes,
        parserVersion: r.meta.parser,
        reportTitle: r.meta.title,
        reportDate: r.meta.reportDate,
        printDate: r.meta.printDate,
        businessUnit: r.meta.businessUnit,
        pageCount: r.meta.pages,
        rowCount: r.rows.length,
        checks: r.checks,
        problems: r.problems,
        uploadedBy: actor.id,
        ...(input.table ? { sourceFormat: input.table.sourceFormat, priceUnit: input.table.priceUnit, columnMap: input.table.columnMap } : {}),
      })
      .onConflictDoNothing({ target: priceListImports.fileSha256 })
      .returning({ id: priceListImports.id });
    if (!created) {
      // Isti fajl otpremljen istovremeno u drugoj sesiji.
      const [other] = await tx.select({ id: priceListImports.id }).from(priceListImports).where(eq(priceListImports.fileSha256, r.sha256));
      return { importId: other.id, duplicate: true, rows: r.rows.length, problems: r.problems.length };
    }
    for (let i = 0; i < r.rows.length; i += 500) {
      await tx.insert(priceListImportRows).values(
        r.rows.slice(i, i + 500).map((row, j) => ({
          importId: created.id,
          lineNo: i + j + 1,
          code: row.code,
          name: row.name,
          vatPercent: String(row.vatPercent),
          vpPrice: centsToDecimal(row.vpPriceCents),
          page: row.page,
          ...(input.table
            ? { rawPrice: centsToDecimal(input.table.rows[i + j].rawCents), fileUnit: input.table.rows[i + j].fileUnit, filePack: input.table.rows[i + j].filePack }
            : {}),
        })),
      );
    }
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceListUploaded,
        entityType: ENTITY,
        entityId: created.id,
        entityLabel: `${input.fileName.slice(0, 120)} (stanje ${r.meta.reportDate})`,
        after: { sha256: r.sha256, rows: r.rows.length, reportDate: r.meta.reportDate, checks: r.checks, problems: r.problems.length },
      },
      tx,
    );
    return { importId: created.id, duplicate: false, rows: r.rows.length, problems: r.problems.length };
  });
}

/* =========================================================================
 * Važeća osnovna cena
 * ====================================================================== */

type Queryable = Pick<ReturnType<typeof getDb>, "execute">;

/** Važeća osnovna cena (u stotim delovima) po artiklu na dan `onDate`. */
export async function effectiveBasePriceCents(onDate: string, q: Queryable = getDb()): Promise<Map<string, number>> {
  if (!ISO.test(onDate)) throw new PriceListError("datum", "Neispravan datum.");
  const rows = await q.execute<{ article_id: string; net_price: string }>(sql`
    SELECT DISTINCT ON (article_id) article_id, net_price::text AS net_price
      FROM article_base_prices
     WHERE valid_from <= ${onDate}::date
     ORDER BY article_id, valid_from DESC, created_at DESC`);
  return new Map([...rows].map((r) => [r.article_id, toCents(r.net_price)]));
}

async function articlesByCode(q: Queryable = getDb()) {
  // Izričita veza šifre iz cenovnika sa postojećim artiklom (0057) važi kao šifra tog artikla.
  const rows = await q.execute<{ id: string; code: string; name: string; unit: string | null }>(sql`
    SELECT id, code, name, unit FROM articles
    UNION ALL
    SELECT a.id, al.code, a.name, a.unit FROM article_code_aliases al JOIN articles a ON a.id = al.article_id
     WHERE NOT EXISTS (SELECT 1 FROM articles x WHERE x.code = al.code)`);
  return new Map([...rows].map((a) => [a.code, a]));
}

async function importRows(importId: string, q: Queryable = getDb()) {
  const rows = await q.execute<{ line_no: number; code: string; name: string; vat_percent: string; vp_price: string; page: number; raw_price: string | null; file_unit: string | null; file_pack: string | null }>(sql`
    SELECT line_no, code, name, vat_percent::text AS vat_percent, vp_price::text AS vp_price, page, raw_price::text AS raw_price, file_unit, file_pack
      FROM price_list_import_rows WHERE import_id = ${importId}::uuid ORDER BY line_no`);
  return [...rows].map((r) => ({
    code: r.code,
    name: r.name,
    vatPercent: Number(r.vat_percent),
    vpPriceCents: toCents(r.vp_price),
    page: r.page,
    lineNo: r.line_no,
    rawCents: r.raw_price === null ? null : toCents(r.raw_price),
    fileUnit: r.file_unit,
    filePack: r.file_pack,
  }));
}

/* =========================================================================
 * Pregled
 * ====================================================================== */

export async function listPriceListImports() {
  const db = getDb();
  return db
    .select({
      id: priceListImports.id,
      fileName: priceListImports.fileName,
      reportDate: priceListImports.reportDate,
      rowCount: priceListImports.rowCount,
      status: priceListImports.status,
      uploadedAt: priceListImports.uploadedAt,
      uploadedBy: users.name,
      decidedAt: priceListImports.decidedAt,
      validFrom: priceListImports.validFrom,
      appliedCount: priceListImports.appliedCount,
      checks: priceListImports.checks,
      sourceFormat: priceListImports.sourceFormat,
    })
    .from(priceListImports)
    .leftJoin(users, eq(users.id, priceListImports.uploadedBy))
    .orderBy(desc(priceListImports.uploadedAt))
    .limit(50);
}

/** Da li kontrole čitanja dozvoljavaju primenu. */
export function checksAllowApply(checks: unknown) {
  const c = (checks ?? {}) as { totalVpMatches?: boolean; rowChecksFailed?: number };
  return c.totalVpMatches === true && c.rowChecksFailed === 0;
}

/**
 * Pregled jednog otpremanja: povezivanje i promene u odnosu na važeću osnovnu
 * cenu na dan `onDate` (podrazumevano: danas), plus poslednja fakturisana
 * osnovna cena kao informacija (nije izvor cene).
 */
export async function loadPriceListReview(actor: Actor, importId: string, onDate?: string) {
  assertImporter(actor);
  const db = getDb();
  const [imp] = await db
    .select()
    .from(priceListImports)
    .where(eq(priceListImports.id, importId))
    .limit(1);
  if (!imp) return null;
  const date = onDate && ISO.test(onDate) ? onDate : imp.validFrom ?? new Date().toISOString().slice(0, 10);
  const [rows, byCode, current] = await Promise.all([importRows(importId), articlesByCode(), effectiveBasePriceCents(date)]);
  const classified = classifyPriceRows(rows, byCode, current);
  const lastInvoiced = await db.execute<{ article_id: string; unit_price: string; issued_on: string }>(sql`
    SELECT DISTINCT ON (l.article_id) l.article_id, l.unit_price::text AS unit_price, i.issued_on::text AS issued_on
      FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
     WHERE l.article_id IS NOT NULL AND l.unit_price > 0 AND i.document_kind = 'faktura'
     ORDER BY l.article_id, i.issued_on DESC, i.id DESC`);
  const lastByArticle = new Map([...lastInvoiced].map((r) => [r.article_id, { cents: toCents(r.unit_price), on: r.issued_on }]));
  const packRows = await db.execute<{ article_id: string; qty: string }>(sql`SELECT article_id, pack_quantity::text AS qty FROM article_pack_sizes`);
  const packQty = new Map([...packRows].map((r) => [r.article_id, Number(r.qty)]));
  const groupRows = await db.execute<{ g: string }>(sql`SELECT DISTINCT product_group AS g FROM articles WHERE product_group IS NOT NULL ORDER BY 1 LIMIT 300`);
  return {
    import: imp,
    onDate: date,
    canApply: imp.status === "pregled" && checksAllowApply(imp.checks),
    summary: summarizeClassification(classified),
    rows: classified.map((r) => ({ ...r, lastInvoiced: r.articleId ? lastByArticle.get(r.articleId) ?? null : null, packQuantity: r.articleId ? packQty.get(r.articleId) ?? null : null })),
    productGroups: [...groupRows].map((g) => g.g),
  };
}

/**
 * Probni obračun: osnovna cena iz OVOG cenovnika + odobreni rabati, za parove
 * kupac–artikal fakturisane u poslednjih 6 meseci, uz poređenje sa
 * poslednjom fakturom. Samo čitanje; ništa se ne upisuje.
 */
export async function trialPriceCalculation(actor: Actor, importId: string, onDate: string, limit = 25) {
  assertImporter(actor);
  if (!ISO.test(onDate)) throw new PriceListError("datum", "Neispravan datum.");
  const db = getDb();
  const [rows, byCode] = await Promise.all([importRows(importId), articlesByCode()]);
  const vpByArticle = new Map<string, number>();
  const articleInfo = new Map<string, { code: string; name: string }>();
  for (const r of rows) {
    const a = byCode.get(r.code);
    if (a) {
      vpByArticle.set(a.id, r.vpPriceCents);
      articleInfo.set(a.id, { code: a.code, name: a.name });
    }
  }
  const statuses = sql.join(ACTIVE_RULE_STATUSES.map((s) => sql`${s}`), sql`, `);
  const [ruleRows, groupRows, meta, pairs] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      SELECT id, customer_scope::text AS "customerScope", product_scope::text AS "productScope", value_kind::text AS "valueKind",
             customer_id AS "customerId", customer_group_id AS "customerGroupId", article_id AS "articleId", product_group AS "productGroup", brand,
             discount_percent::text AS "discountPercent", net_price::text AS "netPrice", effective_from::text AS "effectiveFrom",
             effective_to::text AS "effectiveTo", status::text AS status, payment_condition AS "paymentCondition", rule_kind AS "ruleKind"
        FROM price_rules WHERE status::text IN (${statuses})`),
    db.execute<{ customer_id: string; group_id: string }>(sql`SELECT customer_id, group_id FROM customer_group_members`),
    db.execute<{ id: string; product_group: string | null; brand: string | null }>(sql`SELECT id, product_group, brand FROM articles`),
    db.execute<{ customer_id: string; customer_name: string; article_id: string; unit_price: string; disc: string | null; issued_on: string; number: string }>(sql`
      SELECT DISTINCT ON (i.customer_id, l.article_id) i.customer_id, c.name AS customer_name, l.article_id,
             l.unit_price::text AS unit_price, l.discount_percent::text AS disc, i.issued_on::text AS issued_on, i.number
        FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id JOIN customers c ON c.id = i.customer_id
       WHERE i.issued_on >= (${onDate}::date - interval '6 months') AND l.article_id IS NOT NULL
         AND l.unit_price > 0 AND i.document_kind = 'faktura'
       ORDER BY i.customer_id, l.article_id, i.issued_on DESC, i.id DESC`),
  ]);
  const rules = [...ruleRows];
  const groupsOf = new Map<string, string[]>();
  for (const g of groupRows) groupsOf.set(g.customer_id, [...(groupsOf.get(g.customer_id) ?? []), g.group_id]);
  const artMeta = new Map([...meta].map((m) => [m.id, m]));

  const counts = { parova: 0, isto: 0, novaOsnovica: 0, bezPravilaSaRabatomNaFakturi: 0, drugiRabat: 0, sukob: 0, ostalo: 0 };
  const examples: Record<string, unknown>[] = [];
  for (const p of pairs) {
    const vp = vpByArticle.get(p.article_id);
    if (vp === undefined) continue;
    counts.parova += 1;
    const m = artMeta.get(p.article_id);
    const decision = evaluatePricing(rules, {
      customerId: p.customer_id,
      customerGroupIds: groupsOf.get(p.customer_id) ?? [],
      articleId: p.article_id,
      productGroup: m?.product_group ?? null,
      brand: m?.brand ?? null,
      onDate,
    });
    const net = netPriceFrom(decision, vp / 100);
    const portalNet = Math.round((net.netPrice ?? vp / 100) * 100);
    const lastBase = toCents(p.unit_price);
    const lastDisc = Number(p.disc ?? 0);
    const lastNet = Math.round(lastBase * (1 - lastDisc / 100));
    const winner = decision.winner as { valueKind?: string; discountPercent?: string } | null;
    const rulePercent = winner?.valueKind === "discount_percent" ? Number(winner.discountPercent) : null;
    let kind: keyof typeof counts;
    if (decision.conflict.length) kind = "sukob";
    else if (Math.abs(portalNet - lastNet) <= 1) kind = "isto";
    else if (!winner && lastDisc > 0) kind = "bezPravilaSaRabatomNaFakturi";
    else if (rulePercent !== null && Math.abs(rulePercent - lastDisc) > 0.0005) kind = "drugiRabat";
    else if (vp !== lastBase) kind = "novaOsnovica";
    else kind = "ostalo";
    counts[kind] += 1;
    if (examples.filter((e) => e.kind === kind).length < limit) {
      examples.push({
        kind,
        customer: p.customer_name,
        code: articleInfo.get(p.article_id)?.code,
        name: articleInfo.get(p.article_id)?.name,
        baseCents: vp,
        rulePercent,
        fixedNet: winner?.valueKind === "net_price" ? net.netPrice : null,
        portalNetCents: portalNet,
        invoice: p.number,
        invoiceOn: p.issued_on,
        invoiceBaseCents: lastBase,
        invoiceDiscount: lastDisc,
        invoiceNetCents: lastNet,
      });
    }
  }
  return { onDate, counts, examples };
}

/* =========================================================================
 * Odluka
 * ====================================================================== */

export async function applyPriceList(
  actor: Actor,
  input: { importId: string; validFrom: string; confirmedUnclearCodes: string[]; note?: string | null; newArticles?: NewArticleDecision[] },
) {
  assertImporter(actor);
  if (!ISO.test(input.validFrom)) throw new PriceListError("datum", "Izaberite datum početka važenja.");
  const today = new Date().toISOString().slice(0, 10);
  const maxAhead = new Date(Date.now() + 366 * 86400000).toISOString().slice(0, 10);
  if (input.validFrom > maxAhead) throw new PriceListError("datum", "Datum važenja je više od godinu dana unapred.");
  const note = input.note?.trim().slice(0, 500) || null;

  return getDb().transaction(async (tx) => {
    const locked = await tx.execute<{ id: string; status: string; report_date: string; checks: unknown; file_name: string; price_unit: string | null }>(sql`
      SELECT id, status::text AS status, report_date::text AS report_date, checks, file_name, price_unit
        FROM price_list_imports WHERE id = ${input.importId}::uuid FOR UPDATE`);
    const imp = [...locked][0];
    if (!imp) throw new PriceListError("nema", "Otpremanje ne postoji.");
    if (imp.status !== "pregled") throw new PriceListError("odluceno", "O ovom cenovniku je već odlučeno.");
    if (!checksAllowApply(imp.checks)) throw new PriceListError("kontrole", "Kontrole čitanja nisu prošle — cenovnik se ne primenjuje.");
    if (input.validFrom < imp.report_date) {
      throw new PriceListError("datum", `Datum važenja ne može biti pre datuma stanja izveštaja (${imp.report_date}).`);
    }
    const [rows, byCode, current] = await Promise.all([importRows(input.importId, tx), articlesByCode(tx), effectiveBasePriceCents(input.validFrom, tx)]);
    const classified = classifyPriceRows(rows, byCode, current);
    const toApply = rowsToApply(classified, new Set(input.confirmedUnclearCodes));
    // Novi i izričito povezani artikli (0057) — samo za redove bez artikla, samo uz izričitu odluku.
    const created = await applyNewArticleDecisions(tx, actor, {
      importId: input.importId,
      fileName: imp.file_name,
      validFrom: input.validFrom,
      priceUnit: (imp as { price_unit?: string | null }).price_unit ?? null,
      unmatched: classified.filter((r) => r.status === "nepovezano") as { code: string; name: string; vatPercent: number; vpPriceCents: number; rawCents?: number | null }[],
      decisions: input.newArticles ?? [],
    });
    for (let i = 0; i < toApply.length; i += 500) {
      await tx
        .insert(articleBasePrices)
        .values(
          toApply.slice(i, i + 500).map((r) => ({
            articleId: r.articleId as string,
            netPrice: centsToDecimal(r.vpPriceCents),
            vatPercent: String(r.vatPercent),
            validFrom: input.validFrom,
            source: "cenovnik" as const,
            importId: input.importId,
            createdBy: actor.id,
          })),
        )
        .onConflictDoNothing({ target: [articleBasePrices.importId, articleBasePrices.articleId] });
    }
    await tx
      .update(priceListImports)
      .set({ status: "primenjeno", decidedBy: actor.id, decidedAt: new Date(), validFrom: input.validFrom, appliedCount: toApply.length + created.length, decisionNote: note, decisions: created })
      .where(and(eq(priceListImports.id, input.importId), eq(priceListImports.status, "pregled")));
    const summary = summarizeClassification(classified);
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceListApplied,
        entityType: ENTITY,
        entityId: input.importId,
        entityLabel: `${imp.file_name.slice(0, 120)} — važi od ${input.validFrom}`,
        after: { validFrom: input.validFrom, applied: toApply.length, confirmedUnclear: input.confirmedUnclearCodes.length, summary, pastDate: input.validFrom < today },
        reason: note,
      },
      tx,
    );
    return { applied: toApply.length, created: created.filter((c) => c.mode === "novi").length, linked: created.filter((c) => c.mode === "povezi").length, summary };
  });
}

/* =========================================================================
 * Novi artikli i izričita veza šifre (0057)
 * ====================================================================== */

export type NewArticleDecision =
  | { code: string; mode: "novi"; name: string; unit: string; packLabel: string; packQuantity: string; productGroup?: string | null }
  | { code: string; mode: "povezi"; articleCode: string }
  | { code: string; mode: "preskoci" };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
const UNITS = new Set(["l", "kg", "kom", "m", "par", "set", "kut", "pak", "rol"]);

async function applyNewArticleDecisions(
  tx: Tx,
  actor: Actor,
  input: { importId: string; fileName: string; validFrom: string; priceUnit: string | null; unmatched: { code: string; name: string; vatPercent: number; vpPriceCents: number; rawCents?: number | null }[]; decisions: NewArticleDecision[] },
) {
  const out: { code: string; mode: "novi" | "povezi"; articleId: string; vpCents: number }[] = [];
  const byCode = new Map(input.unmatched.map((r) => [r.code, r]));
  const { parseQuantity, perUnitCents } = await import("@/lib/pricing/tablePriceList.mjs");
  const { NEW_ARTICLE_DEFAULT_PERCENT } = await import("@/lib/pricing/rebateSheet.mjs");
  for (const d of input.decisions) {
    if (d.mode === "preskoci") continue;
    const row = byCode.get(d.code);
    if (!row) throw new PriceListError("novi", `Šifra ${d.code} nije neprepoznat red ovog cenovnika.`);
    const raw = row.rawCents ?? row.vpPriceCents;
    if (d.mode === "novi") {
      const name = d.name.trim();
      const unit = d.unit.trim().toLowerCase();
      const label = d.packLabel.trim();
      const qty = parseQuantity(d.packQuantity);
      if (name.length < 3 || name.length > 200) throw new PriceListError("novi", `${d.code}: upišite naziv artikla (3–200 znakova).`);
      if (!UNITS.has(unit)) throw new PriceListError("novi", `${d.code}: izaberite jedinicu mere.`);
      if (label.length < 2 || label.length > 80) throw new PriceListError("novi", `${d.code}: upišite pakovanje (npr. limenka 0,5 l).`);
      if (!qty) throw new PriceListError("novi", `${d.code}: upišite količinu JM u pakovanju (npr. 0,5).`);
      const vpCents = input.priceUnit === "pak" ? perUnitCents(raw, qty) : raw;
      if (!(vpCents > 0)) throw new PriceListError("novi", `${d.code}: VP cena po JM nije ispravna.`);
      const inserted = await tx.execute<{ id: string }>(sql`
        INSERT INTO articles (code, name, unit, product_group) VALUES (${d.code}, ${name}, ${unit}, ${d.productGroup?.trim() || null})
        ON CONFLICT (code) DO NOTHING RETURNING id`);
      const art = [...inserted][0];
      if (!art) throw new PriceListError("novi", `Artikal sa šifrom ${d.code} je u međuvremenu dodat — osvežite pregled.`);
      await tx.execute(sql`
        INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by)
        VALUES (${art.id}::uuid, ${String(qty)}, ${unit}, ${label}, ${`Uvoz VP cenovnika: ${input.fileName.slice(0, 120)}`}, ${actor.id}::uuid)`);
      await tx.execute(sql`
        INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, import_id, created_by)
        VALUES (${art.id}::uuid, ${centsToDecimal(vpCents)}, ${String(row.vatPercent)}, ${input.validFrom}::date, 'cenovnik', ${input.importId}::uuid, ${actor.id}::uuid)`);
      await tx.execute(sql`
        INSERT INTO article_new_defaults (article_id, discount_percent, import_id, created_by)
        VALUES (${art.id}::uuid, ${String(NEW_ARTICLE_DEFAULT_PERCENT)}, ${input.importId}::uuid, ${actor.id}::uuid)`);
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          action: AUDIT_ACTIONS.priceListArticleCreated,
          entityType: "Artikal",
          entityId: art.id,
          entityLabel: `${d.code} ${name}`,
          after: { code: d.code, name, unit, pack: label, packQuantity: qty, vpCents, defaultRebate: NEW_ARTICLE_DEFAULT_PERCENT, importId: input.importId },
        },
        tx,
      );
      out.push({ code: d.code, mode: "novi", articleId: art.id, vpCents });
      continue;
    }
    const targetRows = await tx.execute<{ id: string; pack_qty: string | null }>(sql`
      SELECT a.id, ps.pack_quantity::text AS pack_qty FROM articles a LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id WHERE a.code = ${d.articleCode.trim()}`);
    const target = [...targetRows][0];
    if (!target) throw new PriceListError("povezi", `${d.code}: ne postoji artikal sa šifrom „${d.articleCode}“.`);
    const qty = target.pack_qty === null ? null : Number(target.pack_qty);
    if (input.priceUnit === "pak" && !qty) throw new PriceListError("povezi", `${d.code}: artikal ${d.articleCode} nema potvrđenu količinu pakovanja — cena po pakovanju se ne može preračunati.`);
    const vpCents = input.priceUnit === "pak" && qty ? perUnitCents(raw, qty) : raw;
    await tx.execute(sql`
      INSERT INTO article_code_aliases (code, article_id, import_id, created_by) VALUES (${d.code}, ${target.id}::uuid, ${input.importId}::uuid, ${actor.id}::uuid)`);
    await tx.execute(sql`
      INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, import_id, created_by)
      VALUES (${target.id}::uuid, ${centsToDecimal(vpCents)}, ${String(row.vatPercent)}, ${input.validFrom}::date, 'cenovnik', ${input.importId}::uuid, ${actor.id}::uuid)
      ON CONFLICT DO NOTHING`);
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceListCodeLinked,
        entityType: "Artikal",
        entityId: target.id,
        entityLabel: `${d.code} → ${d.articleCode}`,
        after: { code: d.code, articleCode: d.articleCode, vpCents, importId: input.importId },
      },
      tx,
    );
    out.push({ code: d.code, mode: "povezi", articleId: target.id, vpCents });
  }
  return out;
}

/* =========================================================================
 * Uvoz iz tabele (CSV/XLSX), 0057
 * ====================================================================== */

export async function prepareTablePriceList(
  actor: Actor,
  input: { fileName: string; bytes: Uint8Array; map: { header: boolean; code: number; price: number; name: number | null; unit: number | null; pack: number | null }; priceUnit: "jm" | "pak" },
): Promise<UploadResult> {
  assertImporter(actor);
  const { buildTableRows, parseCsv, readXlsx, TABLE_PARSER, TableFormatError } = await import("@/lib/pricing/tablePriceList.mjs");
  const { createHash } = await import("node:crypto");
  const { inflateRawSync } = await import("node:zlib");
  const isXlsx = /\.xlsx$/i.test(input.fileName) || (input.bytes[0] === 0x50 && input.bytes[1] === 0x4b);
  let table: string[][];
  try {
    table = isXlsx ? await readXlsx(input.bytes, (d: Uint8Array) => new Uint8Array(inflateRawSync(d))) : parseCsv(new TextDecoder("utf-8").decode(input.bytes));
  } catch (error) {
    if (error instanceof TableFormatError) throw new PriceListError(`format_${(error as { code?: string }).code}`, error.message);
    throw new PriceListError("format", "Fajl se ne može pročitati kao CSV ili XLSX.");
  }
  const db = getDb();
  const known = await db.execute<{ code: string; qty: string | null; vat: string | null }>(sql`
    SELECT a.code, ps.pack_quantity::text AS qty,
           (SELECT b.vat_percent::text FROM article_base_prices b WHERE b.article_id = a.id ORDER BY b.valid_from DESC, b.created_at DESC LIMIT 1) AS vat
      FROM articles a LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id
    UNION ALL
    SELECT al.code, ps.pack_quantity::text, NULL FROM article_code_aliases al LEFT JOIN article_pack_sizes ps ON ps.article_id = al.article_id`);
  const packQtyByCode = new Map<string, number>();
  const vatByCode = new Map<string, number>();
  for (const k of known) {
    if (k.qty !== null) packQtyByCode.set(k.code, Number(k.qty));
    vatByCode.set(k.code, k.vat === null ? 20 : Number(k.vat));
  }
  let built: { rows: { line: number; code: string; name: string; vatPercent: number; vpPriceCents: number; rawCents: number; fileUnit: string | null; filePack: string | null }[]; problems: { line: number; code: string | null; name: string; reason: string }[] };
  try {
    built = buildTableRows(table, input.map, input.priceUnit, { packQtyByCode, vatByCode });
  } catch (error) {
    if (error instanceof TableFormatError) throw new PriceListError(`format_${(error as { code?: string }).code}`, error.message);
    throw error;
  }
  const sha256 = createHash("sha256").update(input.bytes).update(JSON.stringify({ map: input.map, unit: input.priceUnit })).digest("hex");
  const today = new Date().toISOString().slice(0, 10);
  const report = {
    sha256,
    bytes: input.bytes.byteLength,
    meta: { title: "Tabela VP cenovnika", company: null, reportDate: today, printDate: today, businessUnit: null, pages: 1, parser: TABLE_PARSER },
    rows: built.rows.map((r) => ({ code: r.code, name: r.name, vatPercent: r.vatPercent, vpPriceCents: r.vpPriceCents, page: 1 })),
    problems: built.problems,
    checks: { rows: built.rows.length, totalVpMatches: true, rowChecksFailed: 0, unreadable: built.problems.length },
  } as unknown as ParsedReport;
  return recordPriceListReport(actor, {
    fileName: input.fileName,
    report,
    table: { sourceFormat: "tabela", priceUnit: input.priceUnit, columnMap: input.map, rows: built.rows.map((r) => ({ rawCents: r.rawCents, fileUnit: r.fileUnit, filePack: r.filePack })) },
  });
}

export async function discardPriceList(actor: Actor, input: { importId: string; note: string }) {
  assertImporter(actor);
  const note = input.note.trim();
  if (note.length < 5) throw new PriceListError("razlog", "Upišite razlog odbacivanja (bar 5 znakova).");
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(priceListImports)
      .set({ status: "odbaceno", decidedBy: actor.id, decidedAt: new Date(), decisionNote: note.slice(0, 500) })
      .where(and(eq(priceListImports.id, input.importId), eq(priceListImports.status, "pregled")))
      .returning({ id: priceListImports.id, fileName: priceListImports.fileName });
    if (!updated.length) throw new PriceListError("odluceno", "O ovom cenovniku je već odlučeno ili ne postoji.");
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceListDiscarded,
        entityType: ENTITY,
        entityId: input.importId,
        entityLabel: updated[0].fileName.slice(0, 120),
        reason: note,
      },
      tx,
    );
  });
}

/* =========================================================================
 * Pojedinačna izmena osnovne cene
 * ====================================================================== */

export async function setBasePrice(
  actor: Actor,
  input: { articleCode: string; price: string; validFrom: string; reason: string; vatPercent?: string | null },
) {
  assertOwner(actor);
  const code = input.articleCode.trim();
  const priceText = input.price.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(priceText) || Number(priceText) <= 0) {
    throw new PriceListError("cena", "Cena mora biti pozitivan broj sa najviše dve decimale (npr. 1250,00).");
  }
  if (!ISO.test(input.validFrom)) throw new PriceListError("datum", "Izaberite datum početka važenja.");
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw new PriceListError("razlog", "Obrazloženje je obavezno (5–500 znakova).");

  return getDb().transaction(async (tx) => {
    const [article] = await tx.select({ id: articles.id, code: articles.code, name: articles.name }).from(articles).where(eq(articles.code, code)).limit(1);
    if (!article) throw new PriceListError("artikal", `Artikal sa šifrom ${code} ne postoji u portalu.`);
    const before = await tx.execute<{ net_price: string; vat_percent: string; valid_from: string }>(sql`
      SELECT net_price::text AS net_price, vat_percent::text AS vat_percent, valid_from::text AS valid_from
        FROM article_base_prices WHERE article_id = ${article.id}::uuid AND valid_from <= ${input.validFrom}::date
       ORDER BY valid_from DESC, created_at DESC LIMIT 1`);
    const prev = [...before][0] ?? null;
    const vat = input.vatPercent?.trim() ? input.vatPercent.trim().replace(",", ".") : prev?.vat_percent ?? "20";
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(vat)) throw new PriceListError("pdv", "Neispravna stopa PDV-a.");
    const netPrice = Number(priceText).toFixed(2);
    await tx.insert(articleBasePrices).values({
      articleId: article.id,
      netPrice,
      vatPercent: vat,
      validFrom: input.validFrom,
      source: "rucno",
      reason,
      createdBy: actor.id,
    });
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.basePriceChanged,
        entityType: "Osnovna cena artikla",
        entityId: article.id,
        entityLabel: `${article.code} ${article.name}`.slice(0, 160),
        before: prev ? { netPrice: prev.net_price, vatPercent: prev.vat_percent, validFrom: prev.valid_from } : null,
        after: { netPrice, vatPercent: vat, validFrom: input.validFrom },
        reason,
      },
      tx,
    );
    return { articleId: article.id, netPrice, validFrom: input.validFrom };
  });
}

/** Istorija osnovne cene artikla (najnovije prvo). */
export async function basePriceHistory(actor: Actor, articleCode: string) {
  assertOwner(actor);
  const rows = await getDb().execute<{
    net_price: string; vat_percent: string; valid_from: string; source: string; reason: string | null; created_at: string; created_by: string | null; file_name: string | null; code: string; name: string;
  }>(sql`
    SELECT b.net_price::text AS net_price, b.vat_percent::text AS vat_percent, b.valid_from::text AS valid_from, b.source::text AS source,
           b.reason, b.created_at::text AS created_at, u.name AS created_by, i.file_name, a.code, a.name
      FROM article_base_prices b JOIN articles a ON a.id = b.article_id
      LEFT JOIN users u ON u.id = b.created_by LEFT JOIN price_list_imports i ON i.id = b.import_id
     WHERE a.code = ${articleCode.trim()}
     ORDER BY b.valid_from DESC, b.created_at DESC LIMIT 50`);
  return [...rows];
}

/** Broj prepoznatih redova koji bi se primenili (bez nejasnih, koji traže pojedinačnu potvrdu). */
export function rowsToApplyCount(classified: Parameters<typeof rowsToApply>[0]) {
  return rowsToApply(classified, new Set()).length;
}
