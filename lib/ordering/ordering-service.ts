import "server-only";
import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import type { CustomerSession } from "@/lib/authz/customer-session";
import type { PortalUser } from "@/lib/authz/user-repository";
import { recordAudit } from "@/lib/audit/record";
import { getCarsystemProductBySlug, getProductVariantSelector } from "@/lib/carsystem-data";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { resolveLedgerScope, type LedgerScope } from "@/lib/ledger/effective-sales";
import {
  formatOrderNumber,
  formatRequestNumber,
  lineAmounts,
  MAX_LINE_QUANTITY,
  netUnitPrice,
  orderabilityProblem,
  orderTotals,
  parseQuantity,
  quantityProblem,
  quoteKey,
  transitionProblem,
} from "@/lib/ordering/orderRules.mjs";
import { evaluatePricing } from "@/lib/pricing/precedence.mjs";
import { getFamilyForProduct, variantRedirectTarget } from "@/lib/product-families";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * Poručivanje kupca: korpa firme → zahtev → prijem u kancelariji → porudžbina.
 *
 * Tri pravila bez izuzetka:
 *   1. Kupac (`customerId`) dolazi ISKLJUČIVO iz kupčeve sesije; nijedna
 *      funkcija za kupca ne prima `customerId` od pregledača.
 *   2. Cena dolazi ISKLJUČIVO iz aktivnog cenovnika i rabata kupca iz istog
 *      cenovnika. Pregledač šalje samo otisak ponude koju je video.
 *   3. Poručiv je samo artikal sa POTVRĐENOM vezom (`mapped`), tačnom
 *      varijantom i stavkom cenovnika. Predlog veze nikad nije poručiv.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Exec = Database | Tx;

/* ---------------------------------------------------------------------------
 * Režim
 * ------------------------------------------------------------------------ */

export type PriceListInfo = {
  id: string;
  code: string;
  name: string;
  kind: "demo" | "biznisoft";
  currency: string;
  validFrom: string;
  sourceNote: string;
};

export type OrderingMode =
  | { enabled: true; kind: "demo"; priceList: PriceListInfo }
  | { enabled: false; reason: string; priceList: PriceListInfo | null };

async function loadActivePriceList(exec: Exec = getDb()): Promise<PriceListInfo | null> {
  const rows = await exec.execute<{
    id: string; code: string; name: string; kind: "demo" | "biznisoft"; currency: string; valid_from: string; source_note: string;
  }>(sql`
    SELECT id, code, name, kind::text AS kind, currency, valid_from::text AS valid_from, source_note
      FROM price_lists WHERE status = 'active' LIMIT 1`);
  const r = [...rows][0];
  return r
    ? { id: r.id, code: r.code, name: r.name, kind: r.kind, currency: r.currency, validFrom: r.valid_from, sourceNote: r.source_note }
    : null;
}

/**
 * Da li se sme poručivati, i zašto ne.
 *
 * `CUSTOMER_ORDERING=demo` je JEDINI uključen režim, i radi samo nad demo
 * podacima i demo cenovnikom. Stvarni režim ne postoji dok vlasnik ne potvrdi
 * cenovnik, veze artikala i postupak kancelarije.
 */
export async function loadOrderingMode(exec: Exec = getDb()): Promise<OrderingMode> {
  const [priceList, dataset] = await Promise.all([loadActivePriceList(exec), loadDatasetInfo()]);
  if (process.env.CUSTOMER_ORDERING !== "demo") {
    return { enabled: false, reason: "Poručivanje preko sajta još nije uključeno.", priceList };
  }
  if (dataset.kind !== "demo") {
    return { enabled: false, reason: "Demo poručivanje radi samo nad demo podacima.", priceList };
  }
  if (!priceList) return { enabled: false, reason: "Nema aktivnog cenovnika.", priceList };
  if (priceList.kind !== "demo") {
    return { enabled: false, reason: "Stvarni cenovnik još nije odobren za poručivanje.", priceList };
  }
  return { enabled: true, kind: "demo", priceList };
}

/* ---------------------------------------------------------------------------
 * Artikal: katalog, cena, poručivost
 * ------------------------------------------------------------------------ */

type ArticleRow = {
  article_id: string;
  code: string;
  name: string;
  product_group: string | null;
  brand: string | null;
  mapping_status: string | null;
  slug: string | null;
  variant: string | null;
  unit: string | null;
  pack_label: string | null;
  list_price: string | null;
  vat_percent: string | null;
  min_quantity: string | null;
  quantity_step: string | null;
};

type Term = {
  id: string;
  product_scope: string;
  article_id: string | null;
  product_group: string | null;
  brand: string | null;
  discount_percent: string;
};

export type CatalogLink = {
  slug: string;
  name: string;
  href: string;
  image: { src: string; alt: string } | null;
  variantKey: string | null;
  variantLabel: string | null;
};

function catalogFacts(slug: string | null, variantId: string | null) {
  const product = slug ? getCarsystemProductBySlug(slug) : null;
  if (!product) return { productExists: false, rowVariantKeys: [] as string[], link: null as CatalogLink | null };
  const rows = (getProductVariantSelector(product)?.variants ?? []).filter((v) => !v.slug);
  const rowVariantKeys = rows.flatMap((v) => [v.sku, v.id].filter((x): x is string => Boolean(x)));
  const row = variantId
    ? rows.find((v) => [v.sku, v.id].some((k) => k && k.toLowerCase() === variantId.toLowerCase()))
    : null;
  const key = row ? (row.sku ?? row.id) : null;
  const src = row?.image ?? product.productImage?.src ?? null;
  return {
    productExists: true,
    rowVariantKeys,
    link: {
      slug: product.slug,
      name: product.name,
      href: key
        ? `/proizvodi/${product.slug}?varijanta=${encodeURIComponent(key)}`
        : (variantRedirectTarget(product) ?? `/proizvodi/${product.slug}`),
      image: src && !/placeholder/i.test(src) ? { src, alt: product.productImage?.alt ?? product.name } : null,
      variantKey: key,
      variantLabel: row ? (row.label ?? key) : null,
    } satisfies CatalogLink,
  };
}

function priceOf(row: ArticleRow, terms: Term[], customerId: string, list: PriceListInfo, today: string) {
  if (row.list_price === null) return null;
  const rules = terms.map((t) => ({
    id: t.id,
    customerScope: "customer",
    customerId,
    customerGroupId: null,
    productScope: t.product_scope,
    articleId: t.article_id,
    productGroup: t.product_group,
    brand: t.brand,
    valueKind: "discount_percent",
    discountPercent: t.discount_percent,
    netPrice: null,
    effectiveFrom: list.validFrom,
    effectiveTo: null,
  }));
  const decision = evaluatePricing(rules, {
    customerId,
    customerGroupIds: [],
    articleId: row.article_id,
    productGroup: row.product_group,
    brand: row.brand,
    onDate: today,
  });
  const conflict = decision.conflict.length > 0;
  /*
   * Potvrđen rabat (i izričito 0 %) ≠ nepoznat rabat.
   *
   * Bez pravila koje pokriva par kupac–artikal rabat NIJE 0 — nepoznat je.
   * Takva stavka se kupcu prikazuje kao „cena na upit“ (vidi
   * `orderabilityProblem`, `rebate_unknown`), nikad kao puna cenovnička cena
   * predstavljena kao njegova dogovorena cena.
   */
  const rebate: "ugovoren" | "nepoznat" = decision.winner ? "ugovoren" : "nepoznat";
  const discountPercent = decision.winner ? Number(decision.winner.discountPercent) : 0;
  const listPrice = Number(row.list_price);
  return {
    conflict,
    rebate,
    listPrice,
    discountPercent,
    netPrice: netUnitPrice(listPrice, discountPercent),
    vatPercent: Number(row.vat_percent),
    unit: row.unit!,
    packLabel: row.pack_label!,
    minQuantity: Number(row.min_quantity),
    quantityStep: Number(row.quantity_step),
    listKind: list.kind,
    currency: list.currency,
    basis:
      `${list.name} (${list.code})` +
      (decision.winner ? ` · rabat kupca ${discountPercent}% (${decision.levelLabel})` : " · rabat kupca nije potvrđen (cena na upit)"),
  };
}

async function loadArticleRows(exec: Exec, list: PriceListInfo | null, where: SQL): Promise<ArticleRow[]> {
  const rows = await exec.execute<ArticleRow>(sql`
    SELECT a.id AS article_id, a.code, a.name, a.product_group, a.brand,
           m.status::text AS mapping_status, m.catalog_product_slug AS slug, m.catalog_variant_id AS variant,
           pli.unit, pli.pack_label, pli.net_price::text AS list_price, pli.vat_percent::text AS vat_percent,
           pli.min_quantity::text AS min_quantity, pli.quantity_step::text AS quantity_step
      FROM articles a
      LEFT JOIN article_catalog_mappings m
             ON m.article_id = a.id AND m.status NOT IN ('rejected', 'revoked')
      LEFT JOIN price_list_items pli
             ON pli.article_id = a.id AND pli.price_list_id = ${list?.id ?? null}::uuid
     WHERE ${where}`);
  return [...rows];
}

async function loadTerms(exec: Exec, list: PriceListInfo | null, customerId: string): Promise<Term[]> {
  if (!list) return [];
  const rows = await exec.execute<Term>(sql`
    SELECT id, product_scope::text AS product_scope, article_id, product_group, brand, discount_percent::text AS discount_percent
      FROM price_list_customer_terms
     WHERE price_list_id = ${list.id} AND customer_id = ${customerId}`);
  return [...rows];
}

export type ArticleOffer = {
  articleId: string;
  articleCode: string;
  articleName: string;
  catalog: CatalogLink | null;
  price: ReturnType<typeof priceOf>;
  problem: { code: string; message: string } | null;
};

function offerFor(row: ArticleRow, terms: Term[], customerId: string, mode: OrderingMode, today: string): ArticleOffer {
  const facts = catalogFacts(row.slug, row.variant);
  const price = mode.priceList ? priceOf(row, terms, customerId, mode.priceList, today) : null;
  const problem =
    orderabilityProblem({
      mapping: row.mapping_status ? { status: row.mapping_status, catalogProductSlug: row.slug, catalogVariantId: row.variant } : null,
      productExists: facts.productExists,
      rowVariantKeys: facts.rowVariantKeys,
      priceItem: price,
      pricingConflict: price?.conflict ?? false,
      rebateUnknown: price ? price.rebate === "nepoznat" : false,
    }) ?? (mode.enabled ? null : { code: "ordering_off", message: mode.reason });
  return {
    articleId: row.article_id,
    articleCode: row.code,
    articleName: row.name,
    // Slika i put do proizvoda samo uz potvrđenu vezu.
    catalog: row.mapping_status === "mapped" ? facts.link : null,
    price: problem && problem.code !== "ordering_off" ? null : price,
    problem,
  };
}

/**
 * Ponude za artikle po šifri, za JEDNOG kupca (iz sesije). Koristi ih
 * „Poručite ponovo" da zna koja stavka sme da dobije unos količine.
 */
export async function loadOffersByCode(customerId: string, codes: string[]): Promise<Map<string, ArticleOffer>> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const out = new Map<string, ArticleOffer>();
  if (codes.length === 0) return out;
  const db = getDb();
  const mode = await loadOrderingMode(db);
  const [rows, terms] = await Promise.all([
    loadArticleRows(db, mode.priceList, sql`a.code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`),
    loadTerms(db, mode.priceList, customerId),
  ]);
  const today = belgradeDate(new Date());
  // Dva artikla iste šifre: nijedan nije poručiv — ne biramo umesto kancelarije.
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.code, (seen.get(r.code) ?? 0) + 1);
  for (const r of rows) {
    if (seen.get(r.code)! > 1) continue;
    out.set(r.code, offerFor(r, terms, customerId, mode, today));
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Korpa
 * ------------------------------------------------------------------------ */

export type CartLine = ArticleOffer & {
  quantity: number;
  quantityProblem: string | null;
  amounts: { net: number; vat: number; gross: number } | null;
};

export type CartQuote = {
  mode: OrderingMode;
  /** Korpa nosi stavke vraćene iz zahteva na ispravku. */
  correcting: { orderId: string; requestNumber: string; reason: string | null; replacedBy: string | null } | null;
  lines: CartLine[];
  totals: { net: number; vat: number; gross: number };
  fingerprint: string;
  canSubmit: boolean;
  blockers: string[];
};

function fingerprintOf(lines: CartLine[]) {
  const key = quoteKey(
    lines
      .filter((l) => l.price)
      .map((l) => ({ articleId: l.articleId, quantity: l.quantity, netPrice: l.price!.netPrice, vatPercent: l.price!.vatPercent })),
  );
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

/** Korpa firme sa ponudom izračunatom SADA. */
export async function loadCartQuote(customerId: string, exec: Exec = getDb()): Promise<CartQuote> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const mode = await loadOrderingMode(exec);
  const cart = [
    ...(await exec.execute<{ article_id: string; quantity: string; source_order_id: string | null }>(sql`
      SELECT article_id, quantity::text AS quantity, source_order_id FROM customer_cart_items
       WHERE customer_id = ${customerId} ORDER BY created_at, article_id`)),
  ];
  if (cart.length === 0) {
    return { mode, correcting: null, lines: [], totals: { net: 0, vat: 0, gross: 0 }, fingerprint: fingerprintOf([]), canSubmit: false, blockers: ["Korpa je prazna."] };
  }
  const sources = [...new Set(cart.map((c) => c.source_order_id).filter((x): x is string => Boolean(x)))];
  let correcting: CartQuote["correcting"] = null;
  if (sources.length === 1) {
    const [src] = [
      ...(await exec.execute<{ id: string; request_number: string; status_reason: string | null; replaced_by: string | null }>(sql`
        SELECT o.id, o.request_number, o.status_reason,
               (SELECT r.request_number FROM customer_orders r WHERE r.replaces_order_id = o.id) AS replaced_by
          FROM customer_orders o WHERE o.id = ${sources[0]}::uuid AND o.customer_id = ${customerId}`)),
    ];
    if (src) correcting = { orderId: src.id, requestNumber: src.request_number, reason: src.status_reason, replacedBy: src.replaced_by };
  }
  const [rows, terms] = await Promise.all([
    loadArticleRows(exec, mode.priceList, sql`a.id IN (${sql.join(cart.map((c) => sql`${c.article_id}::uuid`), sql`, `)})`),
    loadTerms(exec, mode.priceList, customerId),
  ]);
  const byId = new Map(rows.map((r) => [r.article_id, r]));
  const today = belgradeDate(new Date());

  const lines: CartLine[] = cart.map((c) => {
    const offer = offerFor(byId.get(c.article_id)!, terms, customerId, mode, today);
    const quantity = Number(c.quantity);
    const qp = offer.price ? quantityProblem(quantity, offer.price) : null;
    return {
      ...offer,
      quantity,
      quantityProblem: qp,
      amounts: offer.price && !offer.problem && !qp ? lineAmounts({ quantity, netPrice: offer.price.netPrice, vatPercent: offer.price.vatPercent, listPrice: offer.price.listPrice, discountPercent: offer.price.discountPercent }) : null,
    };
  });
  const valid = lines.filter((l) => l.amounts);
  const blockers = [
    ...(mode.enabled ? [] : [mode.reason]),
    ...lines.filter((l) => l.problem && l.problem.code !== "ordering_off").map((l) => `${l.articleName}: ${l.problem!.message}`),
    ...lines.filter((l) => l.quantityProblem).map((l) => `${l.articleName}: ${l.quantityProblem}`),
  ];
  return {
    mode,
    correcting,
    lines,
    totals: orderTotals(valid.map((l) => ({ quantity: l.quantity, netPrice: l.price!.netPrice, vatPercent: l.price!.vatPercent, listPrice: l.price!.listPrice, discountPercent: l.price!.discountPercent }))),
    fingerprint: fingerprintOf(lines),
    canSubmit: blockers.length === 0,
    blockers,
  };
}

export type CartChange = { ok: true; count: number } | { ok: false; message: string };

async function cartCount(customerId: string, exec: Exec = getDb()) {
  const [r] = [...(await exec.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM customer_cart_items WHERE customer_id = ${customerId}`))];
  return r?.n ?? 0;
}

/** Dodaje artikal (po šifri) u korpu firme iz sesije. Količina se sabira. */
export async function addToCart(session: CustomerSession, input: { articleCode: string; quantity: unknown }): Promise<CartChange> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const offer = (await loadOffersByCode(customerId, [String(input.articleCode ?? "").slice(0, 60)])).get(String(input.articleCode));
  if (!offer) return { ok: false, message: "Artikal ne postoji." };
  if (offer.problem) return { ok: false, message: offer.problem.message };
  const qp = quantityProblem(input.quantity, offer.price!);
  if (qp) return { ok: false, message: qp };
  const q = parseQuantity(input.quantity);
  const db = getDb();
  const [row] = [
    ...(await db.execute<{ quantity: string }>(sql`
      INSERT INTO customer_cart_items (customer_id, article_id, quantity, added_by)
      VALUES (${customerId}, ${offer.articleId}, ${q}, ${session.accountId})
      ON CONFLICT (customer_id, article_id)
      DO UPDATE SET quantity = LEAST(customer_cart_items.quantity + EXCLUDED.quantity, ${MAX_LINE_QUANTITY}),
                    updated_at = now()
      RETURNING quantity::text AS quantity`)),
  ];
  void row;
  return { ok: true, count: await cartCount(customerId, db) };
}

/** Postavlja količinu stavke u korpi firme. Nula ili prazno = uklanjanje. */
export async function setCartQuantity(session: CustomerSession, input: { articleId: string; quantity: unknown }): Promise<CartChange> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const db = getDb();
  if (String(input.quantity ?? "").trim() === "" || Number(input.quantity) === 0) {
    await db.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`);
    return { ok: true, count: await cartCount(customerId, db) };
  }
  const quote = await loadCartQuote(customerId, db);
  const line = quote.lines.find((l) => l.articleId === input.articleId);
  if (!line) return { ok: false, message: "Stavka nije u korpi." };
  const qp = quantityProblem(input.quantity, line.price ?? {});
  if (qp) return { ok: false, message: qp };
  await db.execute(sql`
    UPDATE customer_cart_items SET quantity = ${parseQuantity(input.quantity)}, updated_at = now()
     WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`);
  return { ok: true, count: await cartCount(customerId, db) };
}

export async function removeFromCart(session: CustomerSession, articleId: string): Promise<CartChange> {
  return setCartQuantity(session, { articleId, quantity: 0 });
}

export async function loadCartCount(customerId: string): Promise<number> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  return cartCount(customerId);
}

/* ---------------------------------------------------------------------------
 * Slanje zahteva
 * ------------------------------------------------------------------------ */

export type SubmitResult =
  | { status: "created" | "existing"; orderId: string; requestNumber: string }
  | { status: "reauth"; message: string }
  | { status: "price_changed"; message: string }
  | { status: "blocked"; message: string; blockers: string[] };

function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function existingByKey(exec: Exec, key: string) {
  const [r] = [
    ...(await exec.execute<{ id: string; customer_id: string; request_number: string }>(sql`
      SELECT id, customer_id, request_number FROM customer_orders WHERE idempotency_key = ${key}`)),
  ];
  return r ?? null;
}

/**
 * Šalje korpu firme kao ZAHTEV.
 *
 * - Isti `idempotencyKey` → isti zahtev, bez drugog zapisa (dvostruki klik).
 * - Cena se računa ponovo, u transakciji; ako se otisak razlikuje od onoga
 *   što je kupac video, zahtev se NE šalje i kupac vidi nove cene.
 * - Svaka stavka mora biti poručiva; nijedna se ne izbacuje tiho.
 */
export async function submitCartRequest(
  session: CustomerSession,
  input: { idempotencyKey: string; fingerprint: string; note?: string | null },
): Promise<SubmitResult> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  /*
   * Sesija obnovljena sa zapamćenog uređaja ne šalje porudžbinu bez lozinke:
   * ukraden ili zaboravljen uređaj ne sme moći da poruči u ime firme.
   */
  if (session.assurance === "remembered") {
    return { status: "reauth", message: "Radi sigurnosti, pre slanja ponovo unesite lozinku." };
  }
  const key = String(input.idempotencyKey ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) return { status: "blocked", message: "Neispravan zahtev.", blockers: [] };
  const note = input.note ? String(input.note).trim().slice(0, 1000) || null : null;
  const db = getDb();

  const reuse = async () => {
    const found = await existingByKey(db, key);
    if (!found || found.customer_id !== customerId) return null;
    return { status: "existing" as const, orderId: found.id, requestNumber: found.request_number };
  };
  const earlier = await reuse();
  if (earlier) return earlier;

  try {
    return await db.transaction(async (tx) => {
      // Jedno slanje po firmi u isto vreme: drugi klik čeka, pa vidi praznu korpu ili isti ključ.
      await tx.execute(sql`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`);
      const again = await existingByKey(tx, key);
      if (again) {
        if (again.customer_id !== customerId) return { status: "blocked" as const, message: "Neispravan zahtev.", blockers: [] };
        return { status: "existing" as const, orderId: again.id, requestNumber: again.request_number };
      }

      const quote = await loadCartQuote(customerId, tx);
      if (!quote.canSubmit || !quote.mode.enabled) {
        return { status: "blocked" as const, message: "Zahtev se ne može poslati.", blockers: quote.blockers };
      }
      if (quote.fingerprint !== input.fingerprint) {
        return {
          status: "price_changed" as const,
          message: "Cene ili stavke su se promenile od prikaza korpe. Pregledajte nove iznose i pošaljite ponovo.",
        };
      }

      const year = Number(belgradeDate(new Date()).slice(0, 4));
      const [{ n }] = [...(await tx.execute<{ n: string }>(sql`SELECT nextval('customer_order_request_seq')::text AS n`))];
      const requestNumber = formatRequestNumber(year, Number(n));
      const list = quote.mode.priceList;

      // Ispravka: korpa nosi stavke vraćene iz TAČNO jednog zahteva koji još nema ispravku.
      const correcting = quote.correcting && !quote.correcting.replacedBy ? quote.correcting.orderId : null;
      const [order] = [
        ...(await tx.execute<{ id: string }>(sql`
          INSERT INTO customer_orders (customer_id, submitted_by, request_number, status, idempotency_key,
                                       price_list_id, price_list_kind, currency, net_total, vat_total, gross_total, customer_note,
                                       replaces_order_id)
          VALUES (${customerId}, ${session.accountId}, ${requestNumber}, 'submitted', ${key},
                  ${list.id}, ${list.kind}, ${list.currency}, ${quote.totals.net}, ${quote.totals.vat}, ${quote.totals.gross}, ${note},
                  ${correcting}::uuid)
          RETURNING id`)),
      ];
      if (correcting) {
        await tx.execute(sql`
          INSERT INTO customer_order_events (order_id, kind, actor_customer_user_id, actor_name, reason)
          VALUES (${correcting}::uuid, 'replaced', ${session.accountId}, ${session.name}, ${`Ispravka poslata kao ${requestNumber}`})`);
      }
      let n2 = 0;
      for (const l of quote.lines) {
        n2 += 1;
        const p = l.price!;
        await tx.execute(sql`
          INSERT INTO customer_order_lines (order_id, line_number, article_id, article_code, article_name,
            catalog_product_slug, catalog_variant_id, catalog_name, unit, pack_label, quantity,
            list_price, discount_percent, net_price, vat_percent, line_net, line_vat, line_gross, price_basis)
          VALUES (${order.id}, ${n2}, ${l.articleId}, ${l.articleCode}, ${l.articleName},
            ${l.catalog!.slug}, ${l.catalog!.variantKey}, ${l.catalog!.name}, ${p.unit}, ${p.packLabel}, ${l.quantity},
            ${p.listPrice}, ${p.discountPercent}, ${p.netPrice}, ${p.vatPercent},
            ${l.amounts!.net}, ${l.amounts!.vat}, ${l.amounts!.gross}, ${p.basis})`);
      }
      await tx.execute(sql`
        INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_customer_user_id, actor_name)
        VALUES (${order.id}, NULL, 'submitted', 'submitted', ${session.accountId}, ${session.name})`);
      await tx.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`);
      return { status: "created" as const, orderId: order.id, requestNumber };
    });
  } catch (error) {
    // Dva istovremena slanja sa istim ključem: drugi dobija prvi zahtev.
    if (isUniqueViolation(error)) {
      const found = await reuse();
      if (found) return found;
    }
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * Pregled — kupac
 * ------------------------------------------------------------------------ */

export type OrderListRow = {
  id: string;
  requestNumber: string;
  orderNumber: string | null;
  status: string;
  submittedAt: Date;
  grossTotal: number;
  currency: string;
  lineCount: number;
  priceListKind: "demo" | "biznisoft";
  customerName: string;
  customerId: string;
  replacesNumber: string | null;
};

function scopeWhere(scope: LedgerScope): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  return sql`o.customer_id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

async function listOrders(where: SQL): Promise<OrderListRow[]> {
  const rows = await getDb().execute<{
    id: string; request_number: string; order_number: string | null; status: string; submitted_at: Date;
    gross_total: string; currency: string; line_count: number; price_list_kind: "demo" | "biznisoft";
    customer_name: string; customer_id: string; replaces_number: string | null;
  }>(sql`
    SELECT o.id, o.request_number, o.order_number, o.status::text AS status, o.submitted_at,
           (SELECT p.request_number FROM customer_orders p WHERE p.id = o.replaces_order_id) AS replaces_number,
           o.gross_total::text AS gross_total, o.currency, o.price_list_kind::text AS price_list_kind,
           (SELECT count(*)::int FROM customer_order_lines l WHERE l.order_id = o.id) AS line_count,
           c.name AS customer_name, c.id AS customer_id
      FROM customer_orders o JOIN customers c ON c.id = o.customer_id
     WHERE ${where}
     ORDER BY o.submitted_at DESC
     LIMIT 200`);
  return [...rows].map((r) => ({
    id: r.id, requestNumber: r.request_number, orderNumber: r.order_number, status: r.status,
    submittedAt: new Date(r.submitted_at), grossTotal: Number(r.gross_total), currency: r.currency,
    lineCount: r.line_count, priceListKind: r.price_list_kind, customerName: r.customer_name, customerId: r.customer_id,
    replacesNumber: r.replaces_number,
  }));
}

export type OrderDetail = OrderListRow & {
  replaces: { id: string; requestNumber: string } | null;
  replacedBy: { id: string; requestNumber: string } | null;
  netTotal: number;
  vatTotal: number;
  customerNote: string | null;
  statusReason: string | null;
  biznisoftDocumentNumber: string | null;
  biznisoftRecordedAt: Date | null;
  submittedByName: string;
  lines: {
    lineNumber: number; articleId: string; articleCode: string; articleName: string; catalogSlug: string; catalogVariantId: string | null;
    variantLabel: string | null;
    catalogName: string; unit: string; packLabel: string; quantity: number; listPrice: number; discountPercent: number;
    netPrice: number; vatPercent: number; lineNet: number; lineVat: number; lineGross: number; priceBasis: string;
  }[];
  events: { at: Date; fromStatus: string | null; toStatus: string | null; kind: string; actor: string; staff: boolean; reason: string | null }[];
};

async function loadOrder(where: SQL): Promise<OrderDetail | null> {
  const db = getDb();
  const [head] = [
    ...(await db.execute<{
      id: string; request_number: string; order_number: string | null; status: string; submitted_at: Date;
      gross_total: string; net_total: string; vat_total: string; currency: string; price_list_kind: "demo" | "biznisoft";
      customer_name: string; customer_id: string; customer_note: string | null; status_reason: string | null;
      biznisoft_document_number: string | null; biznisoft_recorded_at: Date | null; submitted_by_name: string;
      replaces_id: string | null; replaces_number: string | null; replaced_by_id: string | null; replaced_by_number: string | null;
    }>(sql`
      SELECT o.id, o.request_number, o.order_number, o.status::text AS status, o.submitted_at,
             o.gross_total::text AS gross_total, o.net_total::text AS net_total, o.vat_total::text AS vat_total,
             o.currency, o.price_list_kind::text AS price_list_kind, c.name AS customer_name, c.id AS customer_id,
             o.customer_note, o.status_reason, o.biznisoft_document_number, o.biznisoft_recorded_at,
             cu.name AS submitted_by_name,
             o.replaces_order_id AS replaces_id,
             (SELECT p.request_number FROM customer_orders p WHERE p.id = o.replaces_order_id) AS replaces_number,
             (SELECT r.id FROM customer_orders r WHERE r.replaces_order_id = o.id) AS replaced_by_id,
             (SELECT r.request_number FROM customer_orders r WHERE r.replaces_order_id = o.id) AS replaced_by_number
        FROM customer_orders o
        JOIN customers c ON c.id = o.customer_id
        JOIN customer_users cu ON cu.id = o.submitted_by
       WHERE ${where}
       LIMIT 1`)),
  ];
  if (!head) return null;
  const [lines, events] = await Promise.all([
    db.execute<Record<string, string>>(sql`
      SELECT line_number::text, article_id, article_code, article_name, catalog_product_slug, catalog_variant_id, catalog_name,
             unit, pack_label, quantity::text, list_price::text, discount_percent::text, net_price::text, vat_percent::text,
             line_net::text, line_vat::text, line_gross::text, price_basis
        FROM customer_order_lines WHERE order_id = ${head.id} ORDER BY line_number`),
    db.execute<{ created_at: Date; from_status: string | null; to_status: string | null; kind: string; actor_name: string; staff: boolean; reason: string | null }>(sql`
      SELECT created_at, from_status::text AS from_status, to_status::text AS to_status, kind, actor_name,
             (actor_user_id IS NOT NULL) AS staff, reason
        FROM customer_order_events WHERE order_id = ${head.id} ORDER BY created_at, id`),
  ]);
  return {
    id: head.id, requestNumber: head.request_number, orderNumber: head.order_number, status: head.status,
    submittedAt: new Date(head.submitted_at), grossTotal: Number(head.gross_total), netTotal: Number(head.net_total),
    vatTotal: Number(head.vat_total), currency: head.currency, priceListKind: head.price_list_kind,
    customerName: head.customer_name, customerId: head.customer_id, lineCount: [...lines].length, replacesNumber: head.replaces_number,
    customerNote: head.customer_note, statusReason: head.status_reason,
    biznisoftDocumentNumber: head.biznisoft_document_number,
    biznisoftRecordedAt: head.biznisoft_recorded_at ? new Date(head.biznisoft_recorded_at) : null,
    submittedByName: head.submitted_by_name,
    replaces: head.replaces_id ? { id: head.replaces_id, requestNumber: head.replaces_number! } : null,
    replacedBy: head.replaced_by_id ? { id: head.replaced_by_id, requestNumber: head.replaced_by_number! } : null,
    lines: [...lines].map((l) => ({
      lineNumber: Number(l.line_number), articleId: l.article_id, articleCode: l.article_code, articleName: l.article_name,
      catalogSlug: l.catalog_product_slug, catalogVariantId: l.catalog_variant_id, catalogName: l.catalog_name,
      variantLabel: variantLabelFor(l.catalog_product_slug, l.catalog_variant_id),
      unit: l.unit, packLabel: l.pack_label, quantity: Number(l.quantity), listPrice: Number(l.list_price),
      discountPercent: Number(l.discount_percent), netPrice: Number(l.net_price), vatPercent: Number(l.vat_percent),
      lineNet: Number(l.line_net), lineVat: Number(l.line_vat), lineGross: Number(l.line_gross), priceBasis: l.price_basis,
    })),
    events: [...events].map((e) => ({
      at: new Date(e.created_at), fromStatus: e.from_status, toStatus: e.to_status, kind: e.kind,
      actor: e.actor_name, staff: e.staff, reason: e.reason,
    })),
  };
}

export async function listCustomerOrders(customerId: string): Promise<OrderListRow[]> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  return listOrders(sql`o.customer_id = ${customerId}`);
}

/** Jedan zahtev kupca. Tuđi ID daje `null` — isto kao nepostojeći. */
export async function loadCustomerOrder(customerId: string, orderId: string): Promise<OrderDetail | null> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  return loadOrder(sql`o.id = ${orderId}::uuid AND o.customer_id = ${customerId}`);
}

/* ---------------------------------------------------------------------------
 * Prelazi statusa
 * ------------------------------------------------------------------------ */

export type TransitionResult = { ok: true; changed: boolean } | { ok: false; message: string };

async function transition(
  where: SQL,
  to: string,
  actor: { kind: "customer"; accountId: string; name: string } | { kind: "office"; user: PortalUser },
  reason: string | null,
): Promise<TransitionResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [o] = [
      ...(await tx.execute<{ id: string; status: string; request_number: string }>(sql`
        SELECT o.id, o.status::text AS status, o.request_number FROM customer_orders o WHERE ${where} FOR UPDATE`)),
    ];
    if (!o) return { ok: false as const, message: "Zahtev ne postoji." };
    // Isti prelaz dvaput (dvostruki klik) nije greška i ne pravi drugi događaj.
    if (o.status === to) return { ok: true as const, changed: false };
    const problem = transitionProblem({ from: o.status, to, actor: actor.kind, reason });
    if (problem) return { ok: false as const, message: problem };

    let orderNumber: string | null = null;
    if (to === "confirmed") {
      const [{ n }] = [...(await tx.execute<{ n: string }>(sql`SELECT nextval('customer_order_number_seq')::text AS n`))];
      orderNumber = formatOrderNumber(Number(belgradeDate(new Date()).slice(0, 4)), Number(n));
    }
    const staffId = actor.kind === "office" ? actor.user.id : null;
    await tx.execute(sql`
      UPDATE customer_orders SET
        status = ${to}::customer_order_status,
        order_number = ${orderNumber},
        status_reason = ${reason ? reason.trim().slice(0, 1000) : null},
        reviewed_by = CASE WHEN ${to} = 'under_review' THEN ${staffId}::uuid ELSE reviewed_by END,
        reviewed_at = CASE WHEN ${to} = 'under_review' THEN now() ELSE reviewed_at END,
        decided_by = CASE WHEN ${to} IN ('confirmed', 'rejected', 'changes_requested') THEN ${staffId}::uuid ELSE decided_by END,
        decided_at = CASE WHEN ${to} IN ('confirmed', 'rejected', 'changes_requested') THEN now() ELSE decided_at END,
        updated_at = now()
      WHERE id = ${o.id}`);
    await tx.execute(sql`
      INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_customer_user_id, actor_user_id, actor_name, reason)
      VALUES (${o.id}, ${o.status}::customer_order_status, ${to}::customer_order_status, 'status',
              ${actor.kind === "customer" ? actor.accountId : null}::uuid, ${staffId}::uuid,
              ${actor.kind === "customer" ? actor.name : actor.user.name}, ${reason ? reason.trim().slice(0, 1000) : null})`);
    if (actor.kind === "office") {
      await recordAudit(
        {
          actor: { id: actor.user.id, name: actor.user.name, role: actor.user.role },
          action: `customer_order.${to}`,
          entityType: "customer_order",
          entityId: o.id,
          entityLabel: orderNumber ?? o.request_number,
          before: { status: o.status },
          after: { status: to, orderNumber },
          reason,
        },
        tx,
      );
    }
    return { ok: true as const, changed: true };
  });
}

/** Kupac otkazuje SVOJ zahtev (samo dok ga kancelarija nije uzela u obradu, ili kad traži izmenu). */
export async function cancelCustomerOrder(session: CustomerSession, orderId: string): Promise<TransitionResult> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, message: "Zahtev ne postoji." };
  return transition(
    sql`o.id = ${orderId}::uuid AND o.customer_id = ${customerId}`,
    "cancelled",
    { kind: "customer", accountId: session.accountId, name: session.name },
    null,
  );
}

/**
 * Nastavak izmene: kancelarija je tražila izmenu, kupac vraća stavke u korpu.
 *
 * - Stari zahtev prelazi u `superseded` („Vraćen na ispravku") i OSTAJE u
 *   istoriji — nije otkazan i ne briše se.
 * - Stavke dolaze u korpu sa `source_order_id`, pa sledeće slanje postaje
 *   ISPRAVKA baš tog zahteva (`replaces_order_id`).
 * - Ponovljen klik ne dodaje stavke dvaput: prelaz i upis idu u istoj
 *   transakciji pod zaključanim redom; drugi poziv vidi `superseded` i ne radi ništa.
 */
export async function returnOrderToCart(session: CustomerSession, orderId: string): Promise<TransitionResult> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, message: "Zahtev ne postoji." };
  const db = getDb();
  return db.transaction(async (tx) => {
    const [o] = [
      ...(await tx.execute<{ id: string; status: string }>(sql`
        SELECT id, status::text AS status FROM customer_orders
         WHERE id = ${orderId}::uuid AND customer_id = ${customerId} FOR UPDATE`)),
    ];
    if (!o) return { ok: false as const, message: "Zahtev ne postoji." };
    if (o.status === "superseded") return { ok: true as const, changed: false };
    const problem = transitionProblem({ from: o.status, to: "superseded", actor: "customer", reason: null });
    if (problem) return { ok: false as const, message: "Stavke se vraćaju u korpu samo kada kancelarija traži izmenu." };

    await tx.execute(sql`UPDATE customer_orders SET status = 'superseded', updated_at = now() WHERE id = ${o.id}`);
    await tx.execute(sql`
      INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_customer_user_id, actor_name, reason)
      VALUES (${o.id}, ${o.status}::customer_order_status, 'superseded', 'status', ${session.accountId}, ${session.name},
              'Stavke vraćene u korpu radi ispravke')`);
    await tx.execute(sql`
      INSERT INTO customer_cart_items (customer_id, article_id, quantity, added_by, source_order_id)
      SELECT ${customerId}, article_id, quantity, ${session.accountId}, ${o.id}
        FROM customer_order_lines WHERE order_id = ${o.id}
      ON CONFLICT (customer_id, article_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, source_order_id = EXCLUDED.source_order_id, updated_at = now()`);
    return { ok: true as const, changed: true };
  });
}

/* ---------------------------------------------------------------------------
 * Kancelarija
 * ------------------------------------------------------------------------ */

/** Zahtevi u opsegu korisnika (komercijalista: samo dodeljeni kupci). */
export async function listOrderRequests(viewer: PortalUser, status?: string | null, query?: string | null): Promise<OrderListRow[]> {
  const scope = await resolveLedgerScope(viewer);
  const statusWhere = status ? sql`o.status::text = ${status}` : sql`true`;
  // Pretraga po broju, kupcu, BizniSoft šifri/nazivu ili kataloškom nazivu stavke.
  const q = (query ?? "").trim().slice(0, 80);
  const term = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const queryWhere = q
    ? sql`(o.request_number ILIKE ${term} OR coalesce(o.order_number, '') ILIKE ${term} OR c.name ILIKE ${term}
           OR EXISTS (SELECT 1 FROM customer_order_lines l WHERE l.order_id = o.id
                       AND (l.article_code ILIKE ${term} OR l.article_name ILIKE ${term} OR l.catalog_name ILIKE ${term})))`
    : sql`true`;
  return listOrders(sql`${scopeWhere(scope)} AND ${statusWhere} AND ${queryWhere}`);
}

export async function loadOrderRequest(viewer: PortalUser, orderId: string): Promise<OrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const scope = await resolveLedgerScope(viewer);
  return loadOrder(sql`o.id = ${orderId}::uuid AND ${scopeWhere(scope)}`);
}

export async function officeTransition(viewer: PortalUser, orderId: string, to: string, reason: string | null): Promise<TransitionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, message: "Zahtev ne postoji." };
  const scope = await resolveLedgerScope(viewer);
  return transition(sql`o.id = ${orderId}::uuid AND ${scopeWhere(scope)}`, to, { kind: "office", user: viewer }, reason);
}

/**
 * Pilot: kancelarija ručno unosi potvrđenu porudžbinu u BizniSoft i ovde
 * upisuje broj tog dokumenta. Portal ne piše u BizniSoft.
 */
export async function recordBiznisoftEntry(viewer: PortalUser, orderId: string, documentNumber: string): Promise<TransitionResult> {
  const doc = String(documentNumber ?? "").trim().slice(0, 60);
  if (doc.length < 2) return { ok: false, message: "Upišite broj dokumenta iz BizniSofta." };
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return { ok: false, message: "Zahtev ne postoji." };
  const scope = await resolveLedgerScope(viewer);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [o] = [
      ...(await tx.execute<{ id: string; status: string; order_number: string | null; doc: string | null }>(sql`
        SELECT o.id, o.status::text AS status, o.order_number, o.biznisoft_document_number AS doc
          FROM customer_orders o WHERE o.id = ${orderId}::uuid AND ${scopeWhere(scope)} FOR UPDATE`)),
    ];
    if (!o) return { ok: false as const, message: "Zahtev ne postoji." };
    if (o.status !== "confirmed") return { ok: false as const, message: "Broj iz BizniSofta se upisuje tek za potvrđenu porudžbinu." };
    if (o.doc === doc) return { ok: true as const, changed: false };
    if (o.doc) return { ok: false as const, message: `Već je upisan broj ${o.doc}. Isprava ide kroz BizniSoft, ne ovde.` };
    await tx.execute(sql`
      UPDATE customer_orders SET biznisoft_document_number = ${doc}, biznisoft_recorded_by = ${viewer.id},
             biznisoft_recorded_at = now(), updated_at = now() WHERE id = ${o.id}`);
    await tx.execute(sql`
      INSERT INTO customer_order_events (order_id, kind, actor_user_id, actor_name, reason)
      VALUES (${o.id}, 'biznisoft_recorded', ${viewer.id}, ${viewer.name}, ${`BizniSoft dokument ${doc}`})`);
    await recordAudit(
      {
        actor: { id: viewer.id, name: viewer.name, role: viewer.role },
        action: "customer_order.biznisoft_recorded",
        entityType: "customer_order",
        entityId: o.id,
        entityLabel: o.order_number,
        after: { biznisoftDocumentNumber: doc },
      },
      tx,
    );
    return { ok: true as const, changed: true };
  });
}

/* ---------------------------------------------------------------------------
 * Veza artikla sa katalogom — provera cilja (ekran mapiranja)
 * ------------------------------------------------------------------------ */

export type CatalogTarget = {
  slug: string;
  name: string;
  image: { src: string; alt: string } | null;
  variants: { key: string; label: string }[];
  requiresVariant: boolean;
};

/** Šta je kataloški proizvod i koje varijante-redove ima. `null` ako ne postoji. */
export function describeCatalogTarget(slug: string): CatalogTarget | null {
  const product = getCarsystemProductBySlug(String(slug ?? "").trim());
  if (!product) return null;
  const rows = (getProductVariantSelector(product)?.variants ?? []).filter((v) => !v.slug);
  const facts = catalogFacts(product.slug, null);
  return {
    slug: product.slug,
    name: product.name,
    image: facts.link?.image ?? null,
    variants: rows.map((v) => ({ key: v.sku ?? v.id, label: v.label ?? v.sku ?? v.id })),
    requiresVariant: rows.length > 1,
  };
}

/**
 * Da li potvrda veze sme da pokazuje na ovaj cilj. Tačan proizvod, i tačna
 * varijanta kada proizvod ima više redova šifara. Ne pogađa se po nazivu.
 */
export function catalogTargetProblem(slug: string | null, variantId: string | null): string | null {
  if (!slug) return "Potvrda veze traži kataloški proizvod.";
  const facts = catalogFacts(slug, variantId);
  if (!facts.productExists) return `Kataloški proizvod „${slug}" ne postoji.`;
  const p = orderabilityProblem({
    mapping: { status: "mapped", catalogProductSlug: slug, catalogVariantId: variantId },
    productExists: true,
    rowVariantKeys: facts.rowVariantKeys,
    priceItem: {},
  });
  return p ? p.message : null;
}

/**
 * Poručivost po artiklu, nezavisno od kupca: veza, varijanta i stavka aktivnog
 * cenovnika. Za kolonu „Za poručivanje" na ekranu mapiranja.
 */
export async function loadArticleOrderability(articleIds: string[]) {
  const out = new Map<string, { orderable: boolean; reason: string | null; catalogName: string | null; variantLabel: string | null }>();
  if (articleIds.length === 0) return out;
  const db = getDb();
  const mode = await loadOrderingMode(db);
  const rows = await loadArticleRows(
    db,
    mode.priceList,
    sql`a.id IN (${sql.join(articleIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
  );
  for (const r of rows) {
    const facts = catalogFacts(r.slug, r.variant);
    const problem = orderabilityProblem({
      mapping: r.mapping_status ? { status: r.mapping_status, catalogProductSlug: r.slug, catalogVariantId: r.variant } : null,
      productExists: facts.productExists,
      rowVariantKeys: facts.rowVariantKeys,
      priceItem: r.list_price === null ? null : {},
    });
    out.set(r.article_id, {
      orderable: !problem,
      reason: problem?.message ?? null,
      catalogName: r.mapping_status === "mapped" ? (facts.link?.name ?? null) : null,
      variantLabel: r.mapping_status === "mapped" ? (facts.link?.variantLabel ?? null) : null,
    });
  }
  return out;
}


/* ---------------------------------------------------------------------------
 * Ponude za ceo katalog (kartice i stranice proizvoda)
 * ------------------------------------------------------------------------ */

export type CatalogOffer = {
  articleCode: string;
  articleName: string;
  /** Slug proizvoda na koji veza pokazuje. */
  slug: string;
  /** Ključ varijante-reda (npr. granulacija), ili `null`. */
  variantKey: string | null;
  variantLabel: string | null;
  /** Ključevi kartica kataloga koje ovaj artikal pokriva (proizvod i porodica). */
  cardKeys: string[];
  catalogName: string;
  unit: string | null;
  packLabel: string | null;
  listPrice: number | null;
  discountPercent: number;
  netPrice: number | null;
  vatPercent: number | null;
  minQuantity: number;
  quantityStep: number;
  /** `orderable` | `no_price` (cena na upit: nije u cenovniku, rabat nepotvrđen ili u sukobu) | ostali razlozi. */
  state: "orderable" | "no_price" | "blocked";
  /** Tačan razlog (`rebate_unknown`, `price_conflict`, `no_price`, …) ili `null`. */
  reason: string | null;
  message: string | null;
};

export type CustomerContacts = {
  reps: { name: string; email: string }[];
};

/**
 * Sve POTVRĐENE veze artikala sa katalogom, sa cenom ovog kupca.
 *
 * Artikli bez potvrđene veze se ne vraćaju: katalog za njih nudi „Zatraži
 * cenu/uslove", nikad cenu. Lager se ne vraća jer izvor ne postoji.
 */
export async function loadCustomerOffers(customerId: string): Promise<{ mode: OrderingMode; offers: CatalogOffer[] }> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const db = getDb();
  const mode = await loadOrderingMode(db);
  const [rows, terms] = await Promise.all([
    loadArticleRows(db, mode.priceList, sql`m.status = 'mapped'`),
    loadTerms(db, mode.priceList, customerId),
  ]);
  const today = belgradeDate(new Date());
  const codeCount = new Map<string, number>();
  for (const r of rows) codeCount.set(r.code, (codeCount.get(r.code) ?? 0) + 1);

  const offers: CatalogOffer[] = [];
  for (const r of rows) {
    if (codeCount.get(r.code)! > 1) continue;
    const offer = offerFor(r, terms, customerId, mode, today);
    const product = r.slug ? getCarsystemProductBySlug(r.slug) : null;
    if (!product || !offer.catalog) continue;
    const family = getFamilyForProduct(product);
    const priced = mode.priceList ? priceOf(r, terms, customerId, mode.priceList, today) : null;
    // Bez cene, nepotvrđen rabat i sukob pravila su za kupca isto: cena na upit.
    const PRICE_ON_REQUEST = ["no_price", "rebate_unknown", "price_conflict"];
    const state: CatalogOffer["state"] = !offer.problem ? "orderable" : PRICE_ON_REQUEST.includes(offer.problem.code) ? "no_price" : "blocked";
    offers.push({
      articleCode: r.code,
      articleName: r.name,
      slug: product.slug,
      variantKey: offer.catalog.variantKey,
      variantLabel: offer.catalog.variantLabel,
      cardKeys: [product.slug, ...(family ? [`family:${family.slug}`] : [])],
      catalogName: offer.catalog.name,
      unit: offer.price?.unit ?? null,
      packLabel: offer.price?.packLabel ?? null,
      listPrice: offer.price?.listPrice ?? null,
      discountPercent: offer.price?.discountPercent ?? 0,
      netPrice: offer.price?.netPrice ?? null,
      vatPercent: offer.price?.vatPercent ?? null,
      minQuantity: priced?.minQuantity ?? 1,
      quantityStep: priced?.quantityStep ?? 1,
      state,
      reason: offer.problem?.code ?? null,
      message: offer.problem?.message ?? null,
    });
  }
  return { mode, offers };
}

/** Komercijalista(i) dodeljen(i) kupcu — kontakt za cenu i posebne uslove. */
export async function loadCustomerContacts(customerId: string): Promise<CustomerContacts> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const rows = await getDb().execute<{ name: string; email: string }>(sql`
    SELECT u.name, u.email FROM customer_assignments ca JOIN users u ON u.id = ca.user_id
     WHERE ca.customer_id = ${customerId} AND u.active ORDER BY u.name`);
  return { reps: [...rows].map((r) => ({ name: r.name, email: r.email })) };
}

/* ---------------------------------------------------------------------------
 * Identitet artikla za interne ekrane: BizniSoft ↔ katalog
 * ------------------------------------------------------------------------ */

export type ArticleIdentity = {
  code: string;
  /** Naziv iz BizniSofta (registar artikala) — za kancelariju i komercijaliste. */
  bizName: string;
  mappingStatus: string | null;
  /** Kataloški proizvod samo uz POTVRĐENU vezu. */
  catalog: { name: string; href: string; variantLabel: string | null } | null;
  packLabel: string | null;
  unit: string | null;
  /** Grupa iz registra artikala; `null` = grupa nije potvrđena. */
  productGroup: string | null;
  /** Da li aktivni cenovnik ima stavku za artikal. Sama cena se ovde NE nosi. */
  hasCurrentPrice: boolean;
};

/**
 * Kako isti artikal izgleda na obe strane. Ne menja ni identitet proizvoda ni
 * veze — samo ih čita. Predlog veze se prikazuje kao stanje, ne kao proizvod.
 */
export async function loadArticleIdentities(codes: string[]): Promise<Map<string, ArticleIdentity>> {
  const out = new Map<string, ArticleIdentity>();
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return out;
  const db = getDb();
  const mode = await loadOrderingMode(db);
  const rows = await loadArticleRows(db, mode.priceList, sql`a.code IN (${sql.join(unique.map((c) => sql`${c}`), sql`, `)})`);
  for (const r of rows) {
    const facts = r.mapping_status === "mapped" ? catalogFacts(r.slug, r.variant) : null;
    out.set(r.code, {
      code: r.code,
      bizName: r.name,
      mappingStatus: r.mapping_status,
      catalog: facts?.link ? { name: facts.link.name, href: facts.link.href, variantLabel: facts.link.variantLabel } : null,
      packLabel: r.pack_label,
      unit: r.unit,
      productGroup: r.product_group?.trim() ? r.product_group : null,
      hasCurrentPrice: r.list_price !== null && r.list_price !== undefined,
    });
  }
  return out;
}

/** Oznaka varijante-reda za prikaz (npr. „P400"), ili `null`. */
export function variantLabelFor(slug: string, variantId: string | null): string | null {
  return variantId ? (catalogFacts(slug, variantId).link?.variantLabel ?? null) : null;
}
