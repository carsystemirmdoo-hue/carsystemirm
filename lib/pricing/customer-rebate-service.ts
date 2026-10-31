import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { dmy } from "@/lib/ordering/panelFormat.mjs";
import { resolveCustomerPrice } from "@/lib/pricing/customerPrice.mjs";
import { ACTIVE_RULE_STATUSES } from "@/lib/pricing/evaluation-service";
import { approvedPaymentOptions } from "@/lib/pricing/payment-option-service";
import { optionLabel } from "@/lib/pricing/paymentOptions.mjs";
import { evaluatePricing, precedenceLevelFor, scopeKeyFor } from "@/lib/pricing/precedence.mjs";
import {
  addDays,
  evaluateEdit,
  NOTICE_RETENTION_DAYS,
  noticeRecipients,
  percentString,
  periodText,
  planReplacement,
  priceFromRabat,
  validatePeriod,
  withNewArticleDefault,
} from "@/lib/pricing/rebateSheet.mjs";

/**
 * Cene po kupcu (0057): pregled i izmena DOGOVORENIH rabata kupca po opciji plaćanja.
 *
 *  - pamti se rabat; cena = važeća VP cena × (1 − rabat), računa se uvek iz osnovne cene na dan;
 *  - izmena se čuva odmah, bez odobrenja: komercijalista za SVOJE kupce, gazda za sve;
 *  - kancelarija i magacioner imaju samo pregled; kupac ovaj ekran nikad ne vidi;
 *  - akcija ne menja redovni rabat — posle isteka on ponovo važi, na tada važeću VP cenu;
 *  - pravila iz ovog toka važe samo u portalu (`biznisoft_entry_required = false`): portal ne tvrdi da
 *    je išta upisano u BizniSoft; rabat na fakturi Tamara i dalje kuca ručno.
 * Svaka radnja sama proverava ovlašćenje — skriveno polje nije ovlašćenje.
 */

export class RebateSheetError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "RebateSheetError";
  }
}

type Viewer = Pick<PortalUser, "id" | "name" | "role" | "permissions">;
type Queryable = Pick<ReturnType<typeof getDb>, "execute">;

export const SHEET_PAGE_SIZE = 60;
export const SHEET_FILTERS = ["svi", "posebni", "akcije", "nepotvrdjeno", "novi"] as const;
export type SheetFilter = (typeof SHEET_FILTERS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Današnji dan u Beogradu (YYYY-MM-DD). */
export function todayBelgrade(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/* =========================================================================
 * Ovlašćenja i opseg
 * ====================================================================== */

function seesAll(user: Viewer) {
  return seesAllCustomers(user) || can(user, "rebates:view_all");
}

export async function canViewCustomer(user: Viewer, customerId: string, q: Queryable = getDb()) {
  if (!can(user, "view:cene_kupca")) return false;
  if (seesAll(user)) return true;
  const rows = await q.execute(sql`SELECT 1 FROM customer_assignments WHERE user_id = ${user.id}::uuid AND customer_id = ${customerId}::uuid`);
  return rows.length > 0;
}

/** Komercijalista samo za dodeljene kupce, gazda za sve. Kancelarija i magacioner nikad. */
export async function canEditCustomer(user: Viewer, customerId: string, q: Queryable = getDb()) {
  if (!can(user, "rebates:edit")) return false;
  if (can(user, "rebates:edit_all")) return true;
  const rows = await q.execute(sql`SELECT 1 FROM customer_assignments WHERE user_id = ${user.id}::uuid AND customer_id = ${customerId}::uuid`);
  return rows.length > 0;
}

/* =========================================================================
 * Učitavanje pravila i cena
 * ====================================================================== */

type Rule = {
  id: string;
  customerScope: string;
  productScope: string;
  valueKind: string;
  customerId: string | null;
  customerGroupId: string | null;
  articleId: string | null;
  productGroup: string | null;
  brand: string | null;
  discountPercent: string | null;
  netPrice: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  paymentCondition: string | null;
  ruleKind: string;
  savedBy: string | null;
  savedAt: string | null;
};

const statusList = () => sql.join(ACTIVE_RULE_STATUSES.map((s) => sql`${s}`), sql`, `);

async function rulesForCustomer(customerId: string, q: Queryable): Promise<Rule[]> {
  const rows = await q.execute<Rule>(sql`
    SELECT r.id, r.customer_scope::text AS "customerScope", r.product_scope::text AS "productScope", r.value_kind::text AS "valueKind",
           r.customer_id AS "customerId", r.customer_group_id AS "customerGroupId", r.article_id AS "articleId", r.product_group AS "productGroup", r.brand,
           r.discount_percent::text AS "discountPercent", r.net_price::text AS "netPrice", r.effective_from::text AS "effectiveFrom",
           r.effective_to::text AS "effectiveTo", r.status::text AS status, r.payment_condition AS "paymentCondition", r.rule_kind AS "ruleKind",
           coalesce(du.name, pu.name) AS "savedBy", to_char(coalesce(r.decided_at, r.proposed_at, r.created_at) AT TIME ZONE 'Europe/Belgrade', 'DD/MM/YYYY') AS "savedAt"
      FROM price_rules r
      LEFT JOIN users du ON du.id = r.decided_by
      LEFT JOIN users pu ON pu.id = r.proposed_by
     WHERE r.status::text IN (${statusList()})
       AND (r.customer_scope::text <> 'customer' OR r.customer_id = ${customerId}::uuid)`);
  return [...rows];
}

type BaseHistory = Map<string, { from: string; cents: number }[]>;

async function baseHistory(articleIds: string[] | null, q: Queryable): Promise<BaseHistory> {
  const rows = await q.execute<{ article_id: string; valid_from: string; net_price: string }>(sql`
    SELECT article_id, valid_from::text AS valid_from, net_price::text AS net_price
      FROM article_base_prices
     ${articleIds === null ? sql`` : articleIds.length ? sql`WHERE article_id IN (${sql.join(articleIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`WHERE false`}
     ORDER BY article_id, valid_from, created_at`);
  const out: BaseHistory = new Map();
  for (const r of rows) {
    const list = out.get(r.article_id) ?? [];
    const cents = Math.round(Number(r.net_price) * 100);
    if (list.length && list[list.length - 1].from === r.valid_from) list[list.length - 1] = { from: r.valid_from, cents };
    else list.push({ from: r.valid_from, cents });
    out.set(r.article_id, list);
  }
  return out;
}

function baseAt(history: BaseHistory, articleId: string, day: string): number | null {
  const list = history.get(articleId);
  if (!list) return null;
  let found: number | null = null;
  for (const h of list) if (h.from <= day) found = h.cents;
  return found;
}

function nextBaseChange(history: BaseHistory, articleId: string, day: string) {
  return history.get(articleId)?.find((h) => h.from > day) ?? null;
}

type ArticleMeta = { id: string; code: string; name: string; unit: string | null; product_group: string | null; brand: string | null; new_default: string | null; pack_label: string | null; pack_qty: string | null };

const SOURCE_LABEL: Record<number, string> = {
  1: "dogovor za artikal",
  2: "rabat za grupu proizvoda",
  3: "rabat za proizvođača",
  4: "osnovni rabat kupca",
  5: "grupa kupaca — artikal",
  6: "grupa kupaca — grupa proizvoda",
  7: "grupa kupaca — proizvođač",
  8: "grupa kupaca — osnovni",
  9: "svi kupci — artikal",
  10: "svi kupci — grupa proizvoda",
  11: "svi kupci — proizvođač",
  12: "opšte pravilo",
};

export type SheetCell = {
  status: "cena" | "na_upit";
  message: string | null;
  rabat: number | null;
  priceCents: number | null;
  sourceLabel: string;
  articleAgreement: boolean;
  newArticleDefault: boolean;
  isPromo: boolean;
  promoTo: string | null;
  regularRabat: number | null;
  afterPromo: { day: string; rabat: number | null; priceCents: number | null } | null;
  upcoming: { kind: string; rabat: number | null; from: string; to: string | null; priceCents: number | null }[];
  savedBy: string | null;
  savedAt: string | null;
  validFrom: string | null;
  fixedPriceRule: boolean;
};

function evaluateCell(rules: Rule[], art: ArticleMeta, customerId: string, groups: string[], option: string | null, day: string, history: BaseHistory): SheetCell {
  const ctx = { customerId, customerGroupIds: groups, articleId: art.id, productGroup: art.product_group, brand: art.brand, onDate: day, paymentCondition: option };
  const decision = withNewArticleDefault(evaluatePricing(rules, ctx), art.new_default === null ? null : Number(art.new_default));
  const base = baseAt(history, art.id, day);
  const price = resolveCustomerPrice(decision, base);
  const w = decision.winner as (Rule & { level?: number; source?: string }) | null;
  const isPromo = w?.ruleKind === "akcija";
  const paused = ((decision as { pausedRegular?: Rule[] }).pausedRegular ?? [])[0] ?? null;
  let afterPromo: SheetCell["afterPromo"] = null;
  if (isPromo && w?.effectiveTo) {
    const d = addDays(w.effectiveTo, 1);
    const next = evaluateCell(rules, art, customerId, groups, option, d, history);
    afterPromo = { day: d, rabat: next.rabat, priceCents: next.priceCents };
  }
  const scopeRules = rules.filter(
    (r) => r.customerScope === "customer" && r.productScope === "article" && r.articleId === art.id && (r.paymentCondition ?? null) === option && r.effectiveFrom > day,
  );
  const rabat = price.status === "cena" ? (price.discountPercent ?? (base ? Number(((1 - price.netCents / base) * 100).toFixed(3)) : null)) : null;
  return {
    status: price.status === "cena" ? "cena" : "na_upit",
    message: price.status === "na_upit" ? price.message : null,
    rabat,
    priceCents: price.status === "cena" ? price.netCents : null,
    sourceLabel: decision.newArticleDefault ? "nov artikal — podrazumevano" : isPromo ? "akcija" : w?.level ? SOURCE_LABEL[w.level] ?? "pravilo" : "nema dogovora",
    articleAgreement: Boolean(w && w.customerScope === "customer" && w.productScope === "article" && !decision.newArticleDefault),
    newArticleDefault: Boolean(decision.newArticleDefault),
    isPromo,
    promoTo: isPromo ? w?.effectiveTo ?? null : null,
    regularRabat: paused?.discountPercent ? Number(paused.discountPercent) : null,
    afterPromo,
    upcoming: scopeRules
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
      .map((r) => ({ kind: r.ruleKind, rabat: r.discountPercent === null ? null : Number(r.discountPercent), from: r.effectiveFrom, to: r.effectiveTo, priceCents: priceFromRabat(baseAt(history, art.id, r.effectiveFrom), r.discountPercent === null ? null : Number(r.discountPercent)) })),
    savedBy: w?.savedBy ?? null,
    savedAt: w?.savedAt ?? null,
    validFrom: w?.effectiveFrom ?? null,
    fixedPriceRule: w?.valueKind === "net_price",
  };
}

/* =========================================================================
 * Izbor kupca
 * ====================================================================== */

export type RebateCustomer = { id: string; name: string; pib: string; city: string | null; reps: string[]; options: { code: string | null; label: string; rabat: number | null }[]; canEdit: boolean };

export async function listRebateCustomers(user: Viewer, query: string, limit = 80): Promise<{ rows: RebateCustomer[]; total: number; seesAll: boolean }> {
  if (!can(user, "view:cene_kupca")) throw new RebateSheetError("forbidden", "Nemate pristup cenama po kupcu.");
  const db = getDb();
  const all = seesAll(user);
  const assigned = all ? null : await loadAssignedCustomerIds(user.id);
  const needle = query.trim().slice(0, 80);
  const like = `%${needle.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const scope = assigned === null ? sql`true` : assigned.length ? sql`c.id IN (${sql.join(assigned.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`false`;
  const rows = await db.execute<{ id: string; name: string; pib: string; city: string | null; reps: string[] | null; total: number }>(sql`
    SELECT c.id, c.name, c.pib, c.city,
           (SELECT array_agg(u.name ORDER BY u.name) FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
             WHERE ca.customer_id = c.id AND u.active AND u.role = 'komercijalista') AS reps,
           count(*) OVER ()::int AS total
      FROM customers c
     WHERE c.active AND ${scope}
       AND (${needle} = '' OR c.name ILIKE ${like} OR c.pib ILIKE ${like} OR coalesce(c.city, '') ILIKE ${like})
     ORDER BY c.name
     LIMIT ${limit}`);
  const list = [...rows];
  const today = todayBelgrade();
  const editAll = can(user, "rebates:edit") && can(user, "rebates:edit_all");
  const assignedSet = new Set(assigned ?? (editAll ? [] : await loadAssignedCustomerIds(user.id)));
  const out: RebateCustomer[] = [];
  for (const c of list) {
    const opts = await customerOptionsWithBase(c.id, today, db);
    out.push({ id: c.id, name: c.name, pib: c.pib, city: c.city, reps: c.reps ?? [], options: opts, canEdit: can(user, "rebates:edit") && (editAll || assignedSet.has(c.id)) });
  }
  return { rows: out, total: list[0]?.total ?? 0, seesAll: all };
}

/** Opcije plaćanja kupca (odobrene danas) i osnovni rabat po opciji (pravilo bez artikla, grupe i proizvođača). */
async function customerOptionsWithBase(customerId: string, day: string, q: Queryable, preloaded?: { rules: Rule[]; groups: string[] }) {
  const codes = await approvedPaymentOptions(customerId, day, q);
  const list: (string | null)[] = codes.length ? codes : [null];
  const rules = preloaded?.rules ?? (await rulesForCustomer(customerId, q));
  const groups = preloaded?.groups ?? [...(await q.execute<{ group_id: string }>(sql`SELECT group_id FROM customer_group_members WHERE customer_id = ${customerId}::uuid`))].map((g) => g.group_id);
  return list.map((code) => {
    const d = evaluatePricing(rules, { customerId, customerGroupIds: groups, articleId: "00000000-0000-0000-0000-000000000000", productGroup: null, brand: null, onDate: day, paymentCondition: code });
    const w = d.winner as Rule | null;
    return { code, label: optionLabel(code), rabat: w?.valueKind === "discount_percent" && w.discountPercent !== null ? Number(w.discountPercent) : null };
  });
}

/* =========================================================================
 * Tabela kupca
 * ====================================================================== */

export type SheetRow = {
  articleId: string;
  code: string;
  name: string;
  unit: string | null;
  pack: { label: string; quantity: number } | null;
  vpCents: number | null;
  vpNext: { from: string; cents: number } | null;
  cells: SheetCell[];
  last: { rabat: number; issuedOn: string; differs: boolean } | null;
};

export type RebateSheet = {
  customer: { id: string; name: string; pib: string; city: string | null; reps: string[] };
  options: { code: string | null; label: string; rabat: number | null }[];
  canEdit: boolean;
  isOffice: boolean;
  today: string;
  rows: SheetRow[];
  counts: Record<SheetFilter, number>;
  total: number;
  page: number;
  pages: number;
};

export async function loadRebateSheet(
  user: Viewer,
  customerId: string,
  opts: { search?: string; filter?: SheetFilter; page?: number; articleIds?: string[] } = {},
): Promise<RebateSheet> {
  if (!UUID.test(customerId)) throw new RebateSheetError("nema", "Kupac ne postoji.");
  const db = getDb();
  if (!(await canViewCustomer(user, customerId, db))) throw new RebateSheetError("forbidden", "Nemate pristup cenama ovog kupca.");
  const today = todayBelgrade();
  const [custRows, rules, groupRows, artRows, history, lastRows] = await Promise.all([
    db.execute<{ id: string; name: string; pib: string; city: string | null; reps: string[] | null }>(sql`
      SELECT c.id, c.name, c.pib, c.city,
             (SELECT array_agg(u.name ORDER BY u.name) FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
               WHERE ca.customer_id = c.id AND u.active AND u.role = 'komercijalista') AS reps
        FROM customers c WHERE c.id = ${customerId}::uuid`),
    rulesForCustomer(customerId, db),
    db.execute<{ group_id: string }>(sql`SELECT group_id FROM customer_group_members WHERE customer_id = ${customerId}::uuid`),
    db.execute<ArticleMeta>(sql`
      SELECT a.id, a.code, a.name, a.unit, a.product_group, a.brand,
             d.discount_percent::text AS new_default, ps.label AS pack_label, ps.pack_quantity::text AS pack_qty
        FROM articles a
        LEFT JOIN article_new_defaults d ON d.article_id = a.id
        LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id
       WHERE (EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id)
              OR EXISTS (SELECT 1 FROM price_rules r WHERE r.customer_id = ${customerId}::uuid AND r.article_id = a.id AND r.status::text IN (${statusList()})))
         AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       ORDER BY a.name, a.code`),
    baseHistory(null, db),
    db.execute<{ article_id: string; disc: string; issued_on: string }>(sql`
      SELECT DISTINCT ON (l.article_id) l.article_id, l.discount_percent::text AS disc, i.issued_on::text AS issued_on
        FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
       WHERE i.customer_id = ${customerId}::uuid AND l.article_id IS NOT NULL AND l.unit_price > 0 AND i.document_kind = 'faktura'
       ORDER BY l.article_id, i.issued_on DESC, i.id DESC`),
  ]);
  const cust = [...custRows][0];
  if (!cust) throw new RebateSheetError("nema", "Kupac ne postoji.");
  const groups = [...groupRows].map((g) => g.group_id);
  const options = await customerOptionsWithBase(customerId, today, db, { rules, groups });
  const lastBy = new Map([...lastRows].map((r) => [r.article_id, r]));
  const only = opts.articleIds ? new Set(opts.articleIds) : null;

  const all: SheetRow[] = [];
  for (const a of artRows) {
    if (only && !only.has(a.id)) continue;
    const cells = options.map((o) => evaluateCell(rules, a, customerId, groups, o.code, today, history));
    const l = lastBy.get(a.id);
    const lastRabat = l ? Number(l.disc) : null;
    all.push({
      articleId: a.id,
      code: a.code,
      name: a.name,
      unit: a.unit,
      pack: a.pack_label && a.pack_qty ? { label: a.pack_label, quantity: Number(a.pack_qty) } : null,
      vpCents: baseAt(history, a.id, today),
      vpNext: nextBaseChange(history, a.id, today),
      cells,
      last: l && lastRabat !== null ? { rabat: lastRabat, issuedOn: l.issued_on, differs: !cells.some((c) => c.rabat !== null && Math.abs(c.rabat - lastRabat) < 0.0005) } : null,
    });
  }
  const test: Record<SheetFilter, (r: SheetRow) => boolean> = {
    svi: () => true,
    posebni: (r) => r.cells.some((c) => c.articleAgreement),
    akcije: (r) => r.cells.some((c) => c.isPromo || c.upcoming.some((u) => u.kind === "akcija")),
    nepotvrdjeno: (r) => r.cells.some((c) => c.status === "na_upit"),
    novi: (r) => r.cells.some((c) => c.newArticleDefault),
  };
  const needle = (opts.search ?? "").trim().toLowerCase();
  const searched = needle ? all.filter((r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)) : all;
  const counts = Object.fromEntries(SHEET_FILTERS.map((f) => [f, searched.filter(test[f]).length])) as Record<SheetFilter, number>;
  const filter = opts.filter && SHEET_FILTERS.includes(opts.filter) ? opts.filter : "svi";
  const filtered = searched.filter(test[filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / SHEET_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1)), pages);
  return {
    customer: { id: cust.id, name: cust.name, pib: cust.pib, city: cust.city, reps: cust.reps ?? [] },
    options,
    canEdit: await canEditCustomer(user, customerId, db),
    isOffice: user.role === "kancelarija",
    today,
    rows: only ? filtered : filtered.slice((page - 1) * SHEET_PAGE_SIZE, page * SHEET_PAGE_SIZE),
    counts,
    total: filtered.length,
    page,
    pages,
  };
}

/* =========================================================================
 * Čuvanje
 * ====================================================================== */

export type SaveItem = { articleId: string; option: string | null; field: "r" | "c"; value: string };
export type SaveInput = {
  customerId: string;
  items: SaveItem[];
  period: { kind: "sada" | "datum" | "akcija"; from?: string | null; to?: string | null };
  replaceConfirmed: boolean;
  note?: string | null;
};
export type SaveResult = {
  saved: number;
  batch: string;
  period: string;
  notified: number;
  recipientsNote: string;
  items: { code: string; name: string; option: string; before: string; after: string }[];
};

const fmtCents = (c: number | null) =>
  c === null ? "—" : new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100);
const fmtPct = (p: number | null) => (p === null ? "—" : `${String(Number(p.toFixed(3))).replace(".", ",")} %`);

export async function saveRebateChanges(actor: Viewer, input: SaveInput, now = new Date()): Promise<SaveResult> {
  if (!UUID.test(input.customerId)) throw new RebateSheetError("nema", "Kupac ne postoji.");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new RebateSheetError("prazno", "Nema izmena za čuvanje.");
  if (input.items.length > 500) throw new RebateSheetError("previse", "Najviše 500 izmena odjednom.");
  const note = input.note?.trim().slice(0, 500) || null;
  const today = todayBelgrade(now);
  const period = validatePeriod(input.period, today);
  if (!period.ok) throw new RebateSheetError("period", period.error);
  const db = getDb();

  return db.transaction(async (tx) => {
    if (!(await canEditCustomer(actor, input.customerId, tx))) throw new RebateSheetError("forbidden", "Rabate ovog kupca ne možete da menjate.");
    const options = await approvedPaymentOptions(input.customerId, today, tx);
    const allowed = new Set<string | null>(options.length ? options : [null]);
    const seen = new Set<string>();
    for (const it of input.items) {
      if (!UUID.test(it.articleId)) throw new RebateSheetError("artikal", "Neispravan artikal.");
      if (!allowed.has(it.option ?? null)) throw new RebateSheetError("opcija", `Opcija plaćanja „${optionLabel(it.option ?? null)}“ nije odobrena ovom kupcu.`);
      if (it.field !== "r" && it.field !== "c") throw new RebateSheetError("polje", "Neispravno polje izmene.");
      const k = `${it.articleId}|${it.option ?? ""}`;
      if (seen.has(k)) throw new RebateSheetError("dupla", "Ista stavka je poslata dva puta.");
      seen.add(k);
    }
    const articleIds = [...new Set(input.items.map((i) => i.articleId))];
    const [rules, groupRows, artRows, history] = await Promise.all([
      rulesForCustomer(input.customerId, tx),
      tx.execute<{ group_id: string }>(sql`SELECT group_id FROM customer_group_members WHERE customer_id = ${input.customerId}::uuid`),
      tx.execute<ArticleMeta & { out: boolean }>(sql`
        SELECT a.id, a.code, a.name, a.unit, a.product_group, a.brand, d.discount_percent::text AS new_default, NULL::text AS pack_label, NULL::text AS pack_qty,
               EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out
          FROM articles a LEFT JOIN article_new_defaults d ON d.article_id = a.id
         WHERE a.id IN (${sql.join(articleIds.map((id) => sql`${id}::uuid`), sql`, `)})`),
      baseHistory(articleIds, tx),
    ]);
    const groups = [...groupRows].map((g) => g.group_id);
    const arts = new Map([...artRows].map((a) => [a.id, a]));
    // Zaključavanje postojećih pravila ISTOG opsega (kupac + artikal + opcija) pre odluke o zameni.
    const existingRows = await tx.execute<{ id: string; article_id: string; payment_condition: string | null; rule_kind: string; effective_from: string; effective_to: string | null; discount_percent: string | null }>(sql`
      SELECT id, article_id, payment_condition, rule_kind, effective_from::text AS effective_from, effective_to::text AS effective_to, discount_percent::text AS discount_percent
        FROM price_rules
       WHERE status::text IN (${statusList()}) AND customer_scope = 'customer' AND customer_id = ${input.customerId}::uuid
         AND product_scope = 'article' AND article_id IN (${sql.join(articleIds.map((id) => sql`${id}::uuid`), sql`, `)})
       FOR UPDATE`);
    const existing = [...existingRows];

    type Planned = { it: SaveItem; art: ArticleMeta; percent: number; priceCents: number | null; beforeTxt: string; afterTxt: string; changes: { id: string; action: "close" | "revoke"; effectiveTo?: string }[]; retTxt: string };
    const planned: Planned[] = [];
    const errors: { articleId: string; option: string | null; message: string }[] = [];
    const conflicts: { articleId: string; option: string | null; message: string }[] = [];
    for (const it of input.items) {
      const art = arts.get(it.articleId);
      if (!art || (art as { out?: boolean }).out) {
        errors.push({ articleId: it.articleId, option: it.option, message: "Artikal nije u ponudi." });
        continue;
      }
      const option = it.option ?? null;
      const before = evaluateCell(rules, art, input.customerId, groups, option, today, history);
      const ev = evaluateEdit(it, baseAt(history, art.id, period.from), { replacesArticleAgreement: before.articleAgreement });
      if (!ev.ok) {
        errors.push({ articleId: it.articleId, option, message: ev.error });
        continue;
      }
      const sameScope = existing
        .filter((r) => r.article_id === art.id && (r.payment_condition ?? null) === option)
        .map((r) => ({ id: r.id, ruleKind: r.rule_kind, effectiveFrom: r.effective_from, effectiveTo: r.effective_to, discountPercent: r.discount_percent }));
      const plan = planReplacement(sameScope, period.kind, period.from, period.to, input.replaceConfirmed);
      if (!plan.ok) {
        conflicts.push({ articleId: art.id, option, message: `${art.code} ${art.name} · ${optionLabel(option)}: ${plan.conflicts.map((c) => `akcija ${fmtPct(Number(c.discountPercent))} ${dmy(c.effectiveFrom)}–${dmy(c.effectiveTo)}`).join(", ")}` });
        continue;
      }
      let retTxt = "";
      if (period.kind === "akcija") {
        const after = evaluateCell(rules.filter((r) => !plan.changes.some((c) => c.id === r.id) || r.ruleKind !== "akcija"), art, input.customerId, groups, option, addDays(period.to as string, 1), history);
        retTxt = ` (posle akcije ${fmtPct(after.rabat)})`;
      }
      planned.push({
        it,
        art,
        percent: ev.percent,
        priceCents: ev.priceCents ?? null,
        beforeTxt: before.status === "cena" ? `${fmtPct(before.rabat)} · ${fmtCents(before.priceCents)}` : "nije potvrđena",
        afterTxt: `${fmtPct(ev.percent)} · ${fmtCents(ev.priceCents ?? null)}`,
        changes: plan.changes,
        retTxt,
      });
    }
    if (errors.length) throw new RebateSheetError("unos", "Ispravite označene stavke — ništa nije sačuvano.", errors);
    if (conflicts.length) throw new RebateSheetError("preklapanje", "Preklapanje sa postojećom akcijom — potvrdite zamenu ili promenite period. Ništa nije sačuvano.", conflicts);

    const batch = `cene-kupca-${randomUUID()}`;
    const reason = note ?? "Cene po kupcu";
    for (const p of planned) {
      for (const ch of p.changes) {
        if (ch.action === "close") {
          await tx.execute(sql`UPDATE price_rules SET effective_to = ${ch.effectiveTo}::date, updated_at = now() WHERE id = ${ch.id}::uuid`);
        } else {
          await tx.execute(sql`
            UPDATE price_rules SET status = 'revoked', decided_by = ${actor.id}::uuid, decided_at = now(),
                   decision_reason = ${`Zamenjeno novim rabatom (${batch})`}, updated_at = now()
             WHERE id = ${ch.id}::uuid`);
        }
      }
      const shape = { customerScope: "customer", customerId: input.customerId, productScope: "article", articleId: p.art.id, paymentCondition: p.it.option ?? null };
      await tx.execute(sql`
        INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, precedence_level, scope_key, value_kind, discount_percent,
                                 effective_from, effective_to, status, reason, biznisoft_entry_required, source_batch, payment_condition, rule_kind,
                                 replaces_rule_id, proposed_by, proposed_at, decided_by, decided_at)
        VALUES ('customer', ${input.customerId}::uuid, 'article', ${p.art.id}::uuid, ${precedenceLevelFor(shape)}, ${scopeKeyFor(shape)}, 'discount_percent',
                ${percentString(p.percent)}, ${period.from}::date, ${period.to}::date, 'approved_pending_biznisoft', ${reason}, false, ${batch},
                ${p.it.option ?? null}, ${period.kind}, ${p.changes[0]?.id ?? null}::uuid, ${actor.id}::uuid, now(), ${actor.id}::uuid, now())`);
    }

    const ptxt = periodText(period.kind, period.from, period.to, today, dmy);
    const items = planned.map((p) => ({ code: p.art.code, name: p.art.name, option: optionLabel(p.it.option ?? null), before: p.beforeTxt, after: p.afterTxt + p.retTxt }));

    // Interno obaveštenje (kupac ga nikad ne dobija); stara se brišu, pravila ostaju.
    await purgeOldNotices(tx);
    const [owners, reps] = await Promise.all([
      tx.execute<{ id: string }>(sql`SELECT id FROM users WHERE role = 'gazda' AND active`),
      tx.execute<{ id: string }>(sql`
        SELECT u.id FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
         WHERE ca.customer_id = ${input.customerId}::uuid AND u.active AND u.role = 'komercijalista'`),
    ]);
    const recipients = noticeRecipients(actor, [...owners], [...reps]);
    for (const r of recipients) {
      await tx.execute(sql`
        INSERT INTO rebate_change_notices (recipient_user_id, actor_user_id, customer_id, source_batch, period, items, note)
        VALUES (${r}::uuid, ${actor.id}::uuid, ${input.customerId}::uuid, ${batch}, ${ptxt}, ${JSON.stringify(items)}::jsonb, ${note})`);
    }
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.customerRebatesSaved,
        entityType: "Cene po kupcu",
        entityId: input.customerId,
        entityLabel: `${planned.length} izmena · ${ptxt}`,
        after: { batch, period, items: planned.map((p) => ({ article: p.art.code, option: p.it.option, percent: p.percent, replaced: p.changes })), recipients: recipients.length },
        reason: note,
        correlationId: batch,
      },
      tx,
    );
    const recipientsNote =
      actor.role === "komercijalista"
        ? "Vlasnik je dobio obaveštenje."
        : recipients.length
          ? "Obaveštenje je poslato dodeljenom komercijalisti."
          : "Kupac nema dodeljenog komercijalistu — obaveštenje nije poslato nikome.";
    return { saved: planned.length, batch, period: ptxt, notified: recipients.length, recipientsNote, items };
  });
}

/* =========================================================================
 * Obaveštenja o izmeni rabata
 * ====================================================================== */

/** Fizičko brisanje obaveštenja starijih od 10 dana; vraća broj obrisanih. Pravila cena se ne diraju. */
export async function purgeOldNotices(q: Queryable = getDb()): Promise<number> {
  const rows = await q.execute<{ id: string }>(sql`DELETE FROM rebate_change_notices WHERE created_at < now() - make_interval(days => ${NOTICE_RETENTION_DAYS}) RETURNING id::text`);
  return rows.length;
}

export type RebateNotice = {
  id: string;
  customerId: string;
  customer: string;
  actor: string;
  createdAt: string;
  expires: string;
  period: string;
  note: string | null;
  read: boolean;
  items: { code: string; name: string; option: string; before: string; after: string }[];
};

export async function listMyNotices(user: Viewer): Promise<RebateNotice[]> {
  if (!can(user, "rebates:edit")) return [];
  const db = getDb();
  await purgeOldNotices(db);
  const rows = await db.execute<{ id: string; customer_id: string; customer: string; actor: string; created: string; expires: string; period: string; note: string | null; read_at: string | null; items: RebateNotice["items"] }>(sql`
    SELECT n.id::text, n.customer_id, c.name AS customer, u.name AS actor,
           to_char(n.created_at AT TIME ZONE 'Europe/Belgrade', 'DD/MM/YYYY HH24:MI') AS created,
           to_char((n.created_at + make_interval(days => ${NOTICE_RETENTION_DAYS})) AT TIME ZONE 'Europe/Belgrade', 'DD/MM/YYYY') AS expires,
           n.period, n.note, n.read_at::text, n.items
      FROM rebate_change_notices n JOIN customers c ON c.id = n.customer_id JOIN users u ON u.id = n.actor_user_id
     WHERE n.recipient_user_id = ${user.id}::uuid
     ORDER BY n.created_at DESC`);
  return [...rows].map((r) => ({ id: r.id, customerId: r.customer_id, customer: r.customer, actor: r.actor, createdAt: r.created, expires: r.expires, period: r.period, note: r.note, read: r.read_at !== null, items: parseItems(r.items) }));
}

function parseItems(v: unknown): RebateNotice["items"] {
  const x = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return []; } })() : v;
  return Array.isArray(x) ? x : [];
}

export async function countMyUnreadNotices(user: Viewer): Promise<number> {
  if (!can(user, "rebates:edit")) return 0;
  const rows = await getDb().execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM rebate_change_notices
     WHERE recipient_user_id = ${user.id}::uuid AND read_at IS NULL AND created_at >= now() - make_interval(days => ${NOTICE_RETENTION_DAYS})`);
  return [...rows][0]?.n ?? 0;
}

export async function setNoticeRead(user: Viewer, id: string, read: boolean) {
  if (!/^\d{1,18}$/.test(id)) throw new RebateSheetError("nema", "Obaveštenje ne postoji.");
  await getDb().execute(sql`
    UPDATE rebate_change_notices SET read_at = ${read ? sql`now()` : sql`NULL`}
     WHERE id = ${id}::bigint AND recipient_user_id = ${user.id}::uuid`);
}

