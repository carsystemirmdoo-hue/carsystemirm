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
 * Svaka radnja sama proverava `pricelist:manage` (samo gazda). Skriveno dugme
 * nije ovlašćenje; akcija u `app/` dodaje svežu MFA potvrdu za upis.
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

const ENTITY = "Cenovnik";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toCents = (v: string | number) => Math.round(Number(v) * 100);

/* =========================================================================
 * Otpremanje
 * ====================================================================== */

export type UploadResult = { importId: string; duplicate: boolean; rows: number; problems: number };

/** PDF → pročitan izveštaj → upis za pregled. Strukturna greška baca PriceListError (ništa se ne upisuje). */
export async function uploadPriceList(actor: Actor, input: { fileName: string; bytes: Uint8Array }): Promise<UploadResult> {
  assertOwner(actor);
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
export async function recordPriceListReport(actor: Actor, input: { fileName: string; report: ParsedReport }): Promise<UploadResult> {
  assertOwner(actor);
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
  const rows = await q.execute<{ id: string; code: string; name: string; unit: string | null }>(sql`SELECT id, code, name, unit FROM articles`);
  return new Map([...rows].map((a) => [a.code, a]));
}

async function importRows(importId: string, q: Queryable = getDb()) {
  const rows = await q.execute<{ line_no: number; code: string; name: string; vat_percent: string; vp_price: string; page: number }>(sql`
    SELECT line_no, code, name, vat_percent::text AS vat_percent, vp_price::text AS vp_price, page
      FROM price_list_import_rows WHERE import_id = ${importId}::uuid ORDER BY line_no`);
  return [...rows].map((r) => ({ code: r.code, name: r.name, vatPercent: Number(r.vat_percent), vpPriceCents: toCents(r.vp_price), page: r.page }));
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
  assertOwner(actor);
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
  return {
    import: imp,
    onDate: date,
    canApply: imp.status === "pregled" && checksAllowApply(imp.checks),
    summary: summarizeClassification(classified),
    rows: classified.map((r) => ({ ...r, lastInvoiced: r.articleId ? lastByArticle.get(r.articleId) ?? null : null })),
  };
}

/**
 * Probni obračun: osnovna cena iz OVOG cenovnika + odobreni rabati, za parove
 * kupac–artikal fakturisane u poslednjih 6 meseci, uz poređenje sa
 * poslednjom fakturom. Samo čitanje; ništa se ne upisuje.
 */
export async function trialPriceCalculation(actor: Actor, importId: string, onDate: string, limit = 25) {
  assertOwner(actor);
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
             effective_to::text AS "effectiveTo", status::text AS status
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
  input: { importId: string; validFrom: string; confirmedUnclearCodes: string[]; note?: string | null },
) {
  assertOwner(actor);
  if (!ISO.test(input.validFrom)) throw new PriceListError("datum", "Izaberite datum početka važenja.");
  const today = new Date().toISOString().slice(0, 10);
  const maxAhead = new Date(Date.now() + 366 * 86400000).toISOString().slice(0, 10);
  if (input.validFrom > maxAhead) throw new PriceListError("datum", "Datum važenja je više od godinu dana unapred.");
  const note = input.note?.trim().slice(0, 500) || null;

  return getDb().transaction(async (tx) => {
    const locked = await tx.execute<{ id: string; status: string; report_date: string; checks: unknown; file_name: string }>(sql`
      SELECT id, status::text AS status, report_date::text AS report_date, checks, file_name
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
      .set({ status: "primenjeno", decidedBy: actor.id, decidedAt: new Date(), validFrom: input.validFrom, appliedCount: toApply.length, decisionNote: note })
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
    return { applied: toApply.length, summary };
  });
}

export async function discardPriceList(actor: Actor, input: { importId: string; note: string }) {
  assertOwner(actor);
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
