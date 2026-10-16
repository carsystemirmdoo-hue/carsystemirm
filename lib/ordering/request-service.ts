import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import type { CustomerSession } from "@/lib/authz/customer-session";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { isPreparedForPortal } from "@/lib/customers/commercial-status.mjs";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { formatRequestNumber, lineAmounts, orderTotals, quantityProblem, quoteKey, transitionProblem } from "@/lib/ordering/orderRules.mjs";
import { customerPrices } from "@/lib/pricing/customer-price-service";
import { approvedPaymentOptions } from "@/lib/pricing/payment-option-service";
import { optionLabel, optionNote } from "@/lib/pricing/paymentOptions.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { billingQuantity, MAX_PACKS, orderPack, packSummary, parsePacks } from "@/lib/ordering/packRule.mjs";
import { catalogOfferFacts, staleVersionProblem } from "@/lib/ordering/ordering-service";

/** Radnja nad zastarelom verzijom zahteva — nosi važeću verziju za ponudu korisniku. */
export class StaleVersionError extends Error {
  constructor(message: string, readonly stale: { currentId: string; currentNumber: string } | undefined) {
    super(message);
  }
}
import { foldedMatch } from "@/lib/ordering/search-fold";
import { isUuid } from "@/lib/sales/filterInput.mjs";
import { notifyOrderSubmitted } from "@/lib/ordering/order-notifications";

/**
 * Zahtev za porudžbinu iz STVARNOG cenovnika (0044):
 * osnovna cena (article_base_prices) − odobren rabat kupca za izabranu odobrenu
 * opciju plaćanja. Kupac bira jednu opciju za ceo zahtev. Stavka bez potvrđene
 * cene za tu opciju je „na upit“: bez iznosa, ne ulazi u zbir, ne izmišlja se.
 *
 * Uključuje se sa CUSTOMER_ORDERING=cenovnik. Slanje NE pravi fakturu ni
 * rezervaciju u BizniSoftu: kancelarija proverava, štampa i unosi ručno.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Exec = Database | Tx;

/** Globalni prekidač (svi kupci). Za pojedinačnog kupca koristiti `orderingEnabledFor`. */
export function requestOrderingEnabled() {
  return process.env.CUSTOMER_ORDERING === "cenovnik";
}

/** Kupac bira BROJ celih pakovanja (packRule.mjs); korak je uvek 1 pakovanje. */
const PACK_STEP = 1;
/** Kancelarija u izmenjenom predlogu unosi količinu u JM (kao pre 0047). */
const officeStep = (unit: string) => (["KOM", "KT"].includes(unit) ? 1 : 0.1);

export type PackFacts = { quantity: number; unit: string; label: string };

export type OptionPrice =
  | {
      status: "cena";
      listPrice: number;
      discountPercent: number;
      /** Cena po BizniSoft JM (npr. po litru) — tako je vodi cenovnik. */
      netPrice: number;
      vatPercent: number;
      basis: string;
      /** Cena JEDNOG potvrđenog pakovanja (isti `lineAmounts` kao stavka); null bez potvrđenog pakovanja. */
      packAmounts: { net: number; vat: number; gross: number } | null;
    }
  | { status: "na_upit"; reason: string; message: string };

export type RequestLine = {
  articleId: string;
  articleCode: string;
  articleName: string;
  unit: string;
  packLabel: string;
  packConfirmed: boolean;
  /** Potvrđeno pakovanje (količina u JM) ili null — tada se artikal ne poručuje preko sajta. */
  pack: PackFacts | null;
  /** Zašto pakovanje nije potvrđeno (za kupca i kancelariju). */
  packProblem: string | null;
  /** 0049: samo upit za nabavku (ne dodaje se u korpu). */
  procurementOnly: boolean;
  /** Broj pakovanja koje je kupac izabrao. */
  packs: number | null;
  /** Obračunska količina u BizniSoft JM = packs × pack.quantity. */
  quantity: number;
  /** „2 × limenka 5 L = 10 LIT“ */
  packSummary: string | null;
  step: number;
  quantityProblem: string | null;
  problem: string | null;
  byOption: Record<string, OptionPrice>;
  /** Za izabranu opciju. */
  selected: OptionPrice | null;
  amounts: { net: number; vat: number; gross: number } | null;
};

export type RequestQuote = {
  enabled: boolean;
  reason: string | null;
  options: { code: string | null; key: string; label: string; note: string }[];
  selected: string | null;
  lines: RequestLine[];
  totals: { net: number; vat: number; gross: number };
  onRequest: number;
  /** Samo prikaz: zbir i broj stavki na upit za SVAKU odobrenu opciju (isto pravilo kao `totals` za izabranu). */
  optionTotals: Record<string, { net: number; vat: number; gross: number; onRequest: number }>;
  fingerprint: string;
  canSubmit: boolean;
  blockers: string[];
  correcting: { orderId: string; requestNumber: string } | null;
};

const keyOf = (code: string | null) => code ?? "osnovni";

type ArticleRow = {
  id: string; code: string; name: string; unit: string | null; out: boolean; fractional: boolean; procurement: boolean;
  pack_quantity: string | null; pack_unit: string | null; pack_label: string | null; pack_fractional: boolean | null;
};

/** 0049: artikal koji trenutno ne prodajemo direktno — samo upit za nabavku, nikad korpa. */
export const PROCUREMENT_ONLY = "Trenutno nije u ponudi za direktno poručivanje — pošaljite upit za nabavku.";

/**
 * `packs`: broj pakovanja koje je kupac izabrao. `quantity` samo za stare stavke
 * korpe (pre 0047, u JM): prevodi se u pakovanja kada se deli celim brojem.
 */
async function priceLines(
  exec: Exec,
  customerId: string,
  items: { articleId: string; packs: number | null; quantity?: number }[],
  option: string | null,
  today: string,
  /** Kancelarija (izmenjen predlog) radi u JM iz BizniSofta: pakovanje je podatak, ne uslov. */
  mode: "customer" | "office" = "customer",
) {
  const ids = items.map((i) => i.articleId);
  const [opts, arts, vats] = await Promise.all([
    approvedPaymentOptions(customerId, today, exec),
    ids.length
      ? exec.execute<ArticleRow>(sql`
          SELECT a.id, a.code, a.name, a.unit, EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out,
                 EXISTS (SELECT 1 FROM articles_procurement_only p WHERE p.article_id = a.id) AS procurement,
                 EXISTS (SELECT 1 FROM invoice_lines l WHERE l.article_id = a.id AND l.quantity <> trunc(l.quantity)) AS fractional,
                 ps.pack_quantity::text AS pack_quantity, ps.unit AS pack_unit, ps.label AS pack_label, ps.fractional_ok AS pack_fractional
            FROM articles a LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id
           WHERE a.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)
      : Promise.resolve([] as ArticleRow[]),
    ids.length
      ? exec.execute<{ article_id: string; vat: string }>(sql`
          SELECT DISTINCT ON (article_id) article_id, vat_percent::text AS vat FROM article_base_prices
           WHERE valid_from <= ${today}::date AND article_id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
           ORDER BY article_id, valid_from DESC, created_at DESC`)
      : Promise.resolve([] as { article_id: string; vat: string }[]),
  ]);
  const codes: (string | null)[] = opts.length ? opts : [null];
  const options = codes.map((c) => ({ code: c, key: keyOf(c), label: optionLabel(c), note: optionNote(c) }));
  const selected = codes.includes(option) ? option : codes[0];
  const vat = new Map([...vats].map((v) => [v.article_id, Number(v.vat)]));
  const byId = new Map([...arts].map((a) => [a.id, a]));
  const perOption = new Map<string, Awaited<ReturnType<typeof customerPrices>>["prices"]>();
  for (const c of codes) perOption.set(keyOf(c), (await customerPrices(customerId, ids, today, c, exec)).prices);
  const lines: RequestLine[] = items.map((it) => {
    const a = byId.get(it.articleId)!;
    const unit = (a.unit ?? "").toUpperCase() || "JM";
    const step = PACK_STEP;
    const rule = orderPack({
      unit: a.unit,
      fractionalSales: a.fractional,
      confirmed: a.pack_quantity && a.pack_unit ? { packQuantity: a.pack_quantity, unit: a.pack_unit, label: a.pack_label ?? "", fractionalOk: Boolean(a.pack_fractional) } : null,
    });
    const pack: PackFacts | null = rule.status === "pack" && !a.procurement ? { quantity: rule.packQuantity, unit: rule.unit, label: rule.label } : null;
    const packProblem = a.procurement ? PROCUREMENT_ONLY : rule.status === "blocked" ? `Pakovanje nije potvrđeno: ${rule.reason}.` : null;
    // Stara stavka (u JM, bez broja pakovanja): prevodi se samo kada se deli celim brojem.
    let packs = it.packs;
    if (packs === null && pack && it.quantity !== undefined) {
      const n = Math.round((it.quantity / pack.quantity) * 1000) / 1000;
      packs = Number.isInteger(n) && n >= 1 ? n : null;
    }
    const quantity = pack && packs !== null ? billingQuantity(packs, pack.quantity) : (it.quantity ?? 0);
    const byOption: Record<string, OptionPrice> = {};
    for (const c of codes) {
      const p = perOption.get(keyOf(c))!.get(it.articleId);
      if (p && p.status === "cena" && p.baseCents !== null && vat.has(it.articleId)) {
        const priced = {
          listPrice: p.baseCents / 100,
          discountPercent: p.discountPercent ?? 0,
          netPrice: p.netCents / 100,
          vatPercent: vat.get(it.articleId)!,
        };
        byOption[keyOf(c)] = {
          status: "cena",
          ...priced,
          basis: `${p.basis} · ${optionLabel(c)}`,
          packAmounts: pack ? lineAmounts({ quantity: pack.quantity, ...priced }) : null,
        };
      } else {
        const reason = p && "reason" in p ? String(p.reason) : "nema_cene";
        byOption[keyOf(c)] = { status: "na_upit", reason, message: p && "message" in p ? p.message : "Cena na upit." };
      }
    }
    // Kancelarija: korak je JM (KOM = 1), osim kada je potvrđeno pakovanje deo jednog KOM (tada korak = pakovanje).
    const oStep = pack && !Number.isInteger(pack.quantity) ? pack.quantity : officeStep(unit);
    const qp = mode === "office"
      ? quantityProblem(quantity, { minQuantity: oStep, quantityStep: oStep })
      : !pack
      ? null
      : packs === null
        ? `Količina ${String(quantity).replace(".", ",")} ${unit} nije ceo broj pakovanja (${pack.label}) — unesite broj pakovanja.`
        : quantityProblem(packs, { minQuantity: 1, quantityStep: 1 });
    const sel = byOption[keyOf(selected)];
    const problem = a.out ? "Artikal nije u aktuelnoj ponudi." : mode === "office" ? null : packProblem;
    return {
      articleId: a.id,
      articleCode: a.code,
      articleName: a.name,
      unit,
      packLabel: pack ? pack.label : `JM: ${unit}`,
      packConfirmed: Boolean(pack),
      pack,
      packProblem,
      procurementOnly: a.procurement,
      packs,
      quantity,
      packSummary: pack && packs !== null ? packSummary(packs, { packQuantity: pack.quantity, unit: pack.unit, label: pack.label }) : null,
      step,
      quantityProblem: qp,
      problem,
      byOption,
      selected: sel,
      amounts:
        sel.status === "cena" && !qp && !problem
          ? lineAmounts({ quantity, netPrice: sel.netPrice, vatPercent: sel.vatPercent, listPrice: sel.listPrice, discountPercent: sel.discountPercent })
          : null,
    };
  });
  return { options, selected, lines };
}

/* ---------------------------------------------------------------------------
 * Ponude javnog kataloga — ISTI obračun kao korpa i slanje (dok. 61 K2)
 * ------------------------------------------------------------------------ */

export type CatalogRequestOffer = {
  articleId: string;
  articleCode: string;
  /** BizniSoft naziv — u njemu je i zapremina pakovanja (npr. „… 5L“). */
  articleName: string;
  slug: string;
  variantKey: string | null;
  variantLabel: string | null;
  cardKeys: string[];
  catalogName: string;
  /** BizniSoft jedinica mere: cena važi za nju (npr. LIT = po litru). */
  unit: string;
  /** Potvrđeno pojedinačno pakovanje (količina u JM); bez njega nema poručivanja preko sajta. */
  pack: PackFacts | null;
  packProblem: string | null;
  /** Korak: 1 pakovanje. */
  step: number;
  /** Cena po svakoj ODOBRENOJ opciji plaćanja kupca (ključ = šifra opcije ili „osnovni“). */
  byOption: Record<string, OptionPrice>;
  /**
   * `orderable` = potvrđeno pakovanje i bar jedna opcija sa cenom; `no_pack` = cena
   * postoji, ali pakovanje nije potvrđeno (ne preračunava se — upit); `no_price` = na upit;
   * `inquiry` = trenutno ne prodajemo direktno — samo upit za nabavku (0049).
   */
  state: "orderable" | "no_price" | "no_pack" | "inquiry";
};

/**
 * Sve POTVRĐENE veze artikal → katalog, sa cenom ovog kupca po odobrenim
 * opcijama plaćanja. Isti `priceLines` kao korpa i slanje — nema drugog
 * obračuna. Bez potvrđene veze artikal se ne nudi (katalog nudi upit); bez
 * cene ili sa nepotvrđenim rabatom → „na upit“, nikad nula ni demo cena.
 * Kupac isključivo iz sesije pozivaoca; rezultat se ne kešira.
 */
export async function loadCatalogRequestOffers(customerId: string): Promise<{
  enabled: boolean;
  reason: string | null;
  options: { code: string | null; key: string; label: string; note: string | null }[];
  offers: CatalogRequestOffer[];
}> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const db = getDb();
  if (!(await orderingEnabledFor(customerId, db))) {
    return { enabled: false, reason: "Poručivanje preko sajta još nije uključeno za Vašu firmu.", options: [], offers: [] };
  }
  const rows = [...(await db.execute<{ id: string; slug: string; variant: string | null }>(sql`
    SELECT a.id, m.catalog_product_slug AS slug, m.catalog_variant_id AS variant
      FROM article_catalog_mappings m JOIN articles a ON a.id = m.article_id
     WHERE m.status = 'mapped' AND m.catalog_product_slug IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       -- Oprema koja se izdaje na revers (0054) se ne nudi na prodaju.
       AND NOT EXISTS (SELECT 1 FROM internal_equipment e WHERE e.code_key = regexp_replace(a.code, '^0+(?=[0-9])', ''))`))];
  if (!rows.length) return { enabled: true, reason: null, options: [], offers: [] };
  const today = belgradeDate(new Date());
  const priced = await priceLines(db, customerId, rows.map((r) => ({ articleId: r.id, packs: 1 })), null, today);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const offers: CatalogRequestOffer[] = [];
  for (const l of priced.lines) {
    const r = byId.get(l.articleId)!;
    const facts = catalogOfferFacts(r.slug, r.variant);
    if (!facts.productExists || !facts.link) continue;
    offers.push({
      articleId: l.articleId,
      articleCode: l.articleCode,
      articleName: l.articleName,
      slug: facts.link.slug,
      variantKey: facts.link.variantKey,
      variantLabel: facts.link.variantLabel,
      cardKeys: facts.cardKeys,
      catalogName: facts.link.name,
      unit: l.unit,
      pack: l.pack,
      packProblem: l.packProblem,
      step: l.step,
      byOption: l.byOption,
      state: l.procurementOnly ? "inquiry" : !Object.values(l.byOption).some((p) => p.status === "cena") ? "no_price" : l.pack ? "orderable" : "no_pack",
    });
  }
  return { enabled: true, reason: null, options: priced.options, offers };
}

/**
 * Cene kupca za zadate artikle (isti `priceLines`) — za „Poručite ponovo“, koji
 * puni istu korpu i za artikle bez kataloške veze (kupac ih zna sa fakture).
 */
export async function loadArticleRequestPrices(customerId: string, articleIds: string[]) {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const ids = [...new Set(articleIds.filter(isUuid))];
  const db = getDb();
  if (!ids.length || !(await orderingEnabledFor(customerId, db))) return { enabled: ids.length ? false : true, options: [], lines: new Map<string, RequestLine>() };
  const priced = await priceLines(db, customerId, ids.map((articleId) => ({ articleId, packs: 1 })), null, belgradeDate(new Date()));
  return { enabled: true, options: priced.options, lines: new Map(priced.lines.map((l) => [l.articleId, l])) };
}

/** Dodavanje iz javnog kataloga: artikal mora imati POTVRĐENU vezu (dok. 61 K4). */
export async function addCatalogItem(session: CustomerSession, input: { articleId: string; packs: unknown }): Promise<RequestCartChange> {
  if (!isUuid(input.articleId)) return { ok: false, message: "Neispravan artikal." };
  const [m] = [...(await getDb().execute<{ ok: boolean }>(sql`
    SELECT true AS ok FROM article_catalog_mappings WHERE article_id = ${input.articleId}::uuid AND status = 'mapped' LIMIT 1`))];
  if (!m) return { ok: false, message: "Ovaj artikal još nije povezan sa katalogom — zatražite cenu/uslove." };
  return addRequestItem(session, input);
}

function fingerprintOf(option: string | null, lines: RequestLine[]) {
  const key = `${keyOf(option)}#${quoteKey(lines.map((l) => ({ articleId: l.articleId, quantity: l.quantity, netPrice: l.selected?.status === "cena" ? l.selected.netPrice : -1, vatPercent: l.selected?.status === "cena" ? l.selected.vatPercent : -1 })))}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

/** Korpa firme kao zahtev, sa cenama za SVE odobrene opcije i zbirom za izabranu. */
export async function loadRequestQuote(customerId: string, option: string | null, exec: Exec = getDb()): Promise<RequestQuote> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const today = belgradeDate(new Date());
  const enabled = await orderingEnabledFor(customerId, exec);
  const cart = [...(await exec.execute<{ article_id: string; quantity: string; pack_count: number | null; source_order_id: string | null }>(sql`
    SELECT article_id, quantity::text AS quantity, pack_count, source_order_id FROM customer_cart_items WHERE customer_id = ${customerId} ORDER BY created_at, article_id`))];
  const priced = await priceLines(exec, customerId, cart.map((c) => ({ articleId: c.article_id, packs: c.pack_count, quantity: Number(c.quantity) })), option, today);
  const sources = [...new Set(cart.map((c) => c.source_order_id).filter((x): x is string => Boolean(x)))];
  let correcting: RequestQuote["correcting"] = null;
  if (sources.length === 1) {
    const [src] = [...(await exec.execute<{ id: string; request_number: string; replaced: boolean }>(sql`
      SELECT o.id, o.request_number, EXISTS (SELECT 1 FROM customer_orders r WHERE r.replaces_order_id = o.id AND r.status <> 'cancelled') AS replaced
        FROM customer_orders o WHERE o.id = ${sources[0]}::uuid AND o.customer_id = ${customerId}`))];
    if (src && !src.replaced) correcting = { orderId: src.id, requestNumber: src.request_number };
  }
  const valid = priced.lines.filter((l) => l.amounts);
  const blockers = [
    ...(enabled ? [] : ["Poručivanje preko sajta još nije uključeno."]),
    ...(cart.length ? [] : ["Korpa je prazna."]),
    ...priced.lines.filter((l) => l.problem).map((l) => `${l.articleName}: ${l.problem}`),
    ...priced.lines.filter((l) => l.quantityProblem).map((l) => `${l.articleName}: ${l.quantityProblem}`),
  ];
  return {
    enabled,
    reason: enabled ? null : "Poručivanje preko sajta još nije uključeno.",
    options: priced.options,
    selected: priced.selected,
    lines: priced.lines,
    totals: orderTotals(valid.map((l) => ({ quantity: l.quantity, netPrice: (l.selected as { netPrice: number }).netPrice, vatPercent: (l.selected as { vatPercent: number }).vatPercent, listPrice: (l.selected as { listPrice: number }).listPrice, discountPercent: (l.selected as { discountPercent: number }).discountPercent }))),
    onRequest: priced.lines.filter((l) => l.selected?.status === "na_upit").length,
    optionTotals: Object.fromEntries(
      priced.options.map((o) => {
        const ok = priced.lines.filter((l) => !l.problem && !l.quantityProblem && l.byOption[o.key]?.status === "cena");
        return [
          o.key,
          {
            ...orderTotals(ok.map((l) => {
              const p = l.byOption[o.key] as Extract<OptionPrice, { status: "cena" }>;
              return { quantity: l.quantity, netPrice: p.netPrice, vatPercent: p.vatPercent, listPrice: p.listPrice, discountPercent: p.discountPercent };
            })),
            onRequest: priced.lines.filter((l) => l.byOption[o.key]?.status === "na_upit").length,
          },
        ];
      }),
    ),
    fingerprint: fingerprintOf(priced.selected, priced.lines),
    canSubmit: blockers.length === 0,
    blockers,
    correcting,
  };
}

/* ---------------------------------------------------------------------------
 * Izbor robe i korpa
 * ------------------------------------------------------------------------ */

/** Artikli koje kupac može da izabere: u programu, sa osnovnom cenom ili ranije kupljeni. Pretraga po šifri/nazivu. */
export async function listRequestArticles(customerId: string, query: string | null, limit = 60) {
  const q = (query ?? "").trim().slice(0, 60);
  const rows = await getDb().execute<{ id: string; code: string; name: string; unit: string | null; bought: boolean; last_on: string | null }>(sql`
    SELECT a.id, a.code, a.name, a.unit,
           EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid) AS bought,
           (SELECT max(i.issued_on)::text FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid) AS last_on
      FROM articles a
     WHERE NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       AND (EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id)
            OR EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid))
       AND ${q ? foldedMatch([sql`a.code`, sql`a.name`], q) : sql`EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid)`}
     ORDER BY bought DESC, last_on DESC NULLS LAST, a.code
     LIMIT ${limit}`);
  const today = belgradeDate(new Date());
  const priced = await priceLines(getDb(), customerId, rows.map((r) => ({ articleId: r.id, packs: 1 })), null, today);
  return { options: priced.options, articles: priced.lines.map((l, i) => ({ ...l, bought: rows[i].bought, lastOn: rows[i].last_on })) };
}

export type RequestCartChange = { ok: true; count: number; linePacks?: number } | { ok: false; message: string };

async function cartCount(customerId: string, exec: Exec = getDb()) {
  const [{ n }] = [...(await exec.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM customer_cart_items WHERE customer_id = ${customerId}`))];
  return n;
}

/** Potvrđeno pakovanje artikla (isto pravilo kao obračun) — za upis u korpu. */
async function packFor(exec: Exec, articleId: string) {
  const [a] = [...(await exec.execute<{ unit: string | null; fractional: boolean; procurement: boolean; pack_quantity: string | null; pack_unit: string | null; pack_label: string | null; pack_fractional: boolean | null }>(sql`
    SELECT a.unit, EXISTS (SELECT 1 FROM invoice_lines l WHERE l.article_id = a.id AND l.quantity <> trunc(l.quantity)) AS fractional,
           EXISTS (SELECT 1 FROM articles_procurement_only p WHERE p.article_id = a.id) AS procurement,
           ps.pack_quantity::text AS pack_quantity, ps.unit AS pack_unit, ps.label AS pack_label, ps.fractional_ok AS pack_fractional
      FROM articles a LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id WHERE a.id = ${articleId}::uuid`))];
  if (!a) return null;
  if (a.procurement) return { status: "blocked" as const, reason: PROCUREMENT_ONLY };
  return orderPack({
    unit: a.unit,
    fractionalSales: a.fractional,
    confirmed: a.pack_quantity && a.pack_unit ? { packQuantity: a.pack_quantity, unit: a.pack_unit, label: a.pack_label ?? "", fractionalOk: Boolean(a.pack_fractional) } : null,
  });
}

const NO_PACK = "Ovaj artikal se za sada ne poručuje preko sajta: pakovanje (zapremina) nije potvrđeno. Pošaljite upit — kancelarija potvrđuje pakovanje i cenu.";

/** Dodavanje u korpu: kupac bira BROJ celih pakovanja; obračunska količina = broj × potvrđeno pakovanje. */
export async function addRequestItem(session: CustomerSession, input: { articleId: string; packs: unknown }): Promise<RequestCartChange> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (!(await orderingEnabledFor(customerId))) return { ok: false, message: "Poručivanje preko sajta još nije uključeno." };
  if (!/^[0-9a-f-]{36}$/.test(input.articleId)) return { ok: false, message: "Neispravan artikal." };
  const db = getDb();
  const [a] = [...(await db.execute<{ out: boolean; ok: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out,
           (EXISTS (SELECT 1 FROM article_base_prices b WHERE b.article_id = a.id)
            OR EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.article_id = a.id AND i.customer_id = ${customerId}::uuid)) AS ok
      FROM articles a WHERE a.id = ${input.articleId}::uuid`))];
  if (!a || !a.ok) return { ok: false, message: "Artikal nije dostupan za zahtev." };
  if (a.out) return { ok: false, message: "Artikal nije u aktuelnoj ponudi." };
  const parsed = parsePacks(input.packs);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const pack = await packFor(db, input.articleId);
  if (!pack || pack.status !== "pack") return { ok: false, message: pack?.status === "blocked" && pack.reason === PROCUREMENT_ONLY ? PROCUREMENT_ONLY : NO_PACK };
  await db.execute(sql`
    INSERT INTO customer_cart_items (customer_id, article_id, quantity, pack_count, added_by)
    VALUES (${customerId}, ${input.articleId}::uuid, ${billingQuantity(parsed.packs, pack.packQuantity)}, ${parsed.packs}, ${session.accountId})
    ON CONFLICT (customer_id, article_id)
    DO UPDATE SET pack_count = LEAST(COALESCE(customer_cart_items.pack_count, 0) + EXCLUDED.pack_count, ${MAX_PACKS}),
                  quantity = LEAST(COALESCE(customer_cart_items.pack_count, 0) + EXCLUDED.pack_count, ${MAX_PACKS}) * ${pack.packQuantity}::numeric,
                  updated_at = now()`);
  const [line] = [...(await db.execute<{ n: number }>(sql`SELECT pack_count AS n FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`))];
  return { ok: true, count: await cartCount(customerId, db), linePacks: line?.n ?? undefined };
}

/** Promena broja pakovanja u korpi; 0 ili prazno uklanja stavku. */
export async function setRequestPacks(session: CustomerSession, input: { articleId: string; packs: unknown }): Promise<RequestCartChange> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  // Isti uslovi kao dodavanje: loš ID je poruka, ne greška baze; isključena proba ne menja korpu (B7).
  if (!isUuid(input.articleId)) return { ok: false, message: "Stavka nije u korpi." };
  if (!(await orderingEnabledFor(customerId))) return { ok: false, message: "Poručivanje preko naloga nije uključeno za Vašu firmu." };
  const db = getDb();
  if (String(input.packs ?? "").trim() === "" || String(input.packs).trim() === "0") {
    await db.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`);
    return { ok: true, count: await cartCount(customerId, db) };
  }
  const [inCart] = [...(await db.execute<{ ok: boolean }>(sql`
    SELECT true AS ok FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`))];
  if (!inCart) return { ok: false, message: "Stavka nije u korpi." };
  const parsed = parsePacks(input.packs);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const pack = await packFor(db, input.articleId);
  if (!pack || pack.status !== "pack") return { ok: false, message: pack?.status === "blocked" && pack.reason === PROCUREMENT_ONLY ? PROCUREMENT_ONLY : NO_PACK };
  await db.execute(sql`
    UPDATE customer_cart_items SET pack_count = ${parsed.packs}, quantity = ${billingQuantity(parsed.packs, pack.packQuantity)}, updated_at = now()
     WHERE customer_id = ${customerId} AND article_id = ${input.articleId}::uuid`);
  return { ok: true, count: await cartCount(customerId, db) };
}

/* ---------------------------------------------------------------------------
 * Slanje
 * ------------------------------------------------------------------------ */

export type RequestSubmitResult =
  | { status: "created" | "existing"; orderId: string; requestNumber: string }
  | { status: "reauth"; message: string }
  | { status: "price_changed"; message: string }
  | { status: "blocked"; message: string; blockers: string[] };

const clip = (v: unknown, n: number) => (v ? String(v).trim().slice(0, n) || null : null);

async function existingByKey(exec: Exec, key: string) {
  const [r] = [...(await exec.execute<{ id: string; customer_id: string; request_number: string }>(sql`
    SELECT id, customer_id, request_number FROM customer_orders WHERE idempotency_key = ${key}`))];
  return r ?? null;
}

/** Razlog „na upit“ u dokumentu: neutralan tekst (čita ga i kancelarija i kupac). */
const ON_REQUEST_NOTE: Record<string, string> = {
  rabat_nepoznat: "rabat kupca za ovaj artikal nije odobren",
  nema_osnovne_cene: "artikal nema važeću osnovnu cenu",
  izuzetak_za_pregled: "poseban dogovor artikla — proveriti za izabranu opciju plaćanja",
  rabat_u_sukobu: "uslovi u sukobu — proveriti",
};

async function insertLines(tx: Tx, orderId: string, lines: RequestLine[]) {
  let n = 0;
  for (const l of lines) {
    n += 1;
    const p = l.selected!;
    if (p.status === "cena") {
      await tx.execute(sql`
        INSERT INTO customer_order_lines (order_id, line_number, article_id, article_code, article_name, catalog_product_slug, catalog_variant_id, unit, pack_label, pack_confirmed, pack_count, pack_quantity, quantity,
          list_price, discount_percent, net_price, vat_percent, line_net, line_vat, line_gross, price_basis, price_status)
        VALUES (${orderId}, ${n}, ${l.articleId}, ${l.articleCode}, ${l.articleName}, ${mappedSlug(l.articleId)}, ${mappedVariant(l.articleId)}, ${l.unit}, ${l.packLabel}, ${l.packConfirmed}, ${l.pack ? l.packs : null}, ${l.pack ? l.pack.quantity : null}, ${l.quantity},
          ${p.listPrice}, ${p.discountPercent}, ${p.netPrice}, ${p.vatPercent}, ${l.amounts!.net}, ${l.amounts!.vat}, ${l.amounts!.gross}, ${p.basis}, 'cena')`);
    } else {
      await tx.execute(sql`
        INSERT INTO customer_order_lines (order_id, line_number, article_id, article_code, article_name, catalog_product_slug, catalog_variant_id, unit, pack_label, pack_confirmed, pack_count, pack_quantity, quantity,
          list_price, discount_percent, net_price, vat_percent, line_net, line_vat, line_gross, price_basis, price_status, on_request_reason)
        VALUES (${orderId}, ${n}, ${l.articleId}, ${l.articleCode}, ${l.articleName}, ${mappedSlug(l.articleId)}, ${mappedVariant(l.articleId)}, ${l.unit}, ${l.packLabel}, ${l.packConfirmed}, ${l.pack ? l.packs : null}, ${l.pack ? l.pack.quantity : null}, ${l.quantity},
          NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${"cena na upit"}, 'na_upit', ${ON_REQUEST_NOTE[p.reason] ?? "cenu potvrđuje kancelarija"})`);
    }
  }
}

/** Potvrđena kataloška veza artikla u trenutku slanja — kancelarija vidi proizvod i varijantu. */
const mappedSlug = (articleId: string) =>
  sql`(SELECT catalog_product_slug FROM article_catalog_mappings WHERE article_id = ${articleId} AND status = 'mapped')`;
const mappedVariant = (articleId: string) =>
  sql`(SELECT catalog_variant_id FROM article_catalog_mappings WHERE article_id = ${articleId} AND status = 'mapped')`;

/**
 * Slanje zahteva. Server: opcija mora biti odobrena tom kupcu i važiti danas;
 * cena se računa ponovo u transakciji (otisak); isti ključ → isti zahtev.
 */
export async function submitOrderRequest(
  session: CustomerSession,
  input: { idempotencyKey: string; fingerprint: string; paymentOption: string | null; note?: string | null; deliveryAddress?: string | null; contactPhone?: string | null },
): Promise<RequestSubmitResult> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (session.assurance === "remembered") return { status: "reauth", message: "Radi sigurnosti, pre slanja ponovo unesite lozinku." };
  const key = String(input.idempotencyKey ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) return { status: "blocked", message: "Neispravan zahtev.", blockers: [] };
  const db = getDb();
  const earlier = await existingByKey(db, key);
  if (earlier) return earlier.customer_id === customerId ? { status: "existing", orderId: earlier.id, requestNumber: earlier.request_number } : { status: "blocked", message: "Neispravan zahtev.", blockers: [] };
  let created: Parameters<typeof notifyOrderSubmitted>[0] | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`);
      const again = await existingByKey(tx, key);
      if (again) return again.customer_id === customerId ? { status: "existing" as const, orderId: again.id, requestNumber: again.request_number } : { status: "blocked" as const, message: "Neispravan zahtev.", blockers: [] };
      const [st] = [...(await tx.execute<{ status: string }>(sql`SELECT status FROM customer_commercial_status WHERE customer_id = ${customerId}::uuid`))];
      if (st && !isPreparedForPortal(st.status)) return { status: "blocked" as const, message: "Zahtev preko sajta nije dostupan za ovu firmu. Javite se kancelariji.", blockers: [] };
      const today = belgradeDate(new Date());
      const approved = await approvedPaymentOptions(customerId, today, tx);
      const opt = input.paymentOption ?? null;
      if (approved.length ? !approved.includes(opt ?? "") : opt !== null) {
        // Opcija je opozvana ili promenjena posle prikaza korpe: nova potvrda kupca, ne tiha zamena.
        return { status: "price_changed" as const, message: "Izabrana opcija plaćanja više nije odobrena za Vašu firmu. Izaberite odobrenu opciju, pregledajte nove iznose i potvrdite ponovo." };
      }
      const quote = await loadRequestQuote(customerId, opt, tx);
      if (!quote.canSubmit) return { status: "blocked" as const, message: "Zahtev se ne može poslati.", blockers: quote.blockers };
      if (quote.fingerprint !== input.fingerprint) {
        return { status: "price_changed" as const, message: "Cene, opcija plaćanja ili stavke su se promenile od prikaza. Pregledajte nove iznose i potvrdite ponovo." };
      }
      const year = Number(today.slice(0, 4));
      const [{ n }] = [...(await tx.execute<{ n: string }>(sql`SELECT nextval('customer_order_request_seq')::text AS n`))];
      const requestNumber = formatRequestNumber(year, Number(n));
      const correcting = quote.correcting?.orderId ?? null;
      const [order] = [...(await tx.execute<{ id: string }>(sql`
        INSERT INTO customer_orders (customer_id, submitted_by, request_number, status, idempotency_key, pricing_source, currency,
                                     net_total, vat_total, gross_total, customer_note, replaces_order_id, payment_option, payment_option_label,
                                     delivery_address, contact_phone, on_request_lines)
        VALUES (${customerId}, ${session.accountId}, ${requestNumber}, 'submitted', ${key}, 'cenovnik', 'RSD',
                ${quote.totals.net}, ${quote.totals.vat}, ${quote.totals.gross}, ${clip(input.note, 1000)}, ${correcting}::uuid, ${opt}, ${opt ? optionLabel(opt) : null},
                ${clip(input.deliveryAddress, 300)}, ${clip(input.contactPhone, 40)}, ${quote.onRequest})
        RETURNING id`))];
      if (correcting) {
        await tx.execute(sql`INSERT INTO customer_order_events (order_id, kind, actor_customer_user_id, actor_name, reason)
                             VALUES (${correcting}::uuid, 'replaced', ${session.accountId}, ${session.name}, ${`Ispravka poslata kao ${requestNumber}`})`);
      }
      await insertLines(tx, order.id, quote.lines);
      await tx.execute(sql`INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_customer_user_id, actor_name)
                           VALUES (${order.id}, NULL, 'submitted', 'submitted', ${session.accountId}, ${session.name})`);
      await tx.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId}`);
      created = { orderId: order.id, requestNumber, customerName: session.customerName, lineCount: quote.lines.length, onRequest: quote.onRequest, revision: false };
      return { status: "created" as const, orderId: order.id, requestNumber };
    });
    // Posle upisa, van transakcije: kancelarija saznaje i kada lista nije otvorena (B3).
    if (created) await notifyOrderSubmitted(created);
    return result;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      const found = await existingByKey(db, key);
      if (found && found.customer_id === customerId) return { status: "existing", orderId: found.id, requestNumber: found.request_number };
    }
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * Izmenjen predlog kancelarije → potvrda kupca
 * ------------------------------------------------------------------------ */

async function statusEvent(tx: Tx, orderId: string, from: string | null, to: string, actor: { staff?: PortalUser; customer?: CustomerSession }, reason: string | null) {
  await tx.execute(sql`
    INSERT INTO customer_order_events (order_id, from_status, to_status, kind, actor_user_id, actor_customer_user_id, actor_name, reason)
    VALUES (${orderId}, ${from}::customer_order_status, ${to}::customer_order_status, 'status', ${actor.staff?.id ?? null}, ${actor.customer?.accountId ?? null},
            ${actor.staff?.name ?? actor.customer?.name ?? "—"}, ${reason})`);
}

/**
 * Kancelarija priprema IZMENJEN PREDLOG (roba, količine; cene po važećim odobrenim
 * uslovima i istoj opciji plaćanja). Original ostaje netaknut ('changes_requested'
 * sa razlogom); predlog je nova verzija koja čeka potvrdu kupca.
 */
export async function proposeOrderRevision(viewer: PortalUser, orderId: string, input: { lines: { articleId: string; quantity: number }[]; reason: string; expectedVersion?: string | null }) {
  if (!can(viewer, "customer_orders:review")) throw new Error("Nemate pravo da menjate zahteve.");
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Razlog izmene: najmanje 5 znakova.");
  const items = input.lines.filter((l) => l.quantity > 0);
  if (!items.length) throw new Error("Izmenjen predlog mora imati bar jednu stavku.");
  const scope = await resolveLedgerScope(viewer);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [o] = [...(await tx.execute<{ id: string; customer_id: string; status: string; request_number: string; revision: number; payment_option: string | null; pricing_source: string; delivery_address: string | null; contact_phone: string | null; customer_note: string | null }>(sql`
      SELECT id, customer_id, status::text AS status, request_number, revision, payment_option, pricing_source, delivery_address, contact_phone, customer_note
        FROM customer_orders WHERE id = ${orderId}::uuid FOR UPDATE`))];
    if (!o) throw new Error("Zahtev ne postoji.");
    if (scope.customerIds !== null && !scope.customerIds.includes(o.customer_id)) throw new Error("Zahtev nije u Vašem opsegu.");
    if (o.pricing_source !== "cenovnik") throw new Error("Izmenjen predlog važi samo za zahteve iz stvarnog cenovnika.");
    const stale = await staleVersionProblem(tx, o.id, input.expectedVersion);
    if (stale) throw new StaleVersionError(stale.message, stale.stale);
    if (!["submitted", "under_review", "changes_requested"].includes(o.status)) throw new Error("Predlog izmene je moguć dok je zahtev poslat, u obradi ili čeka izmenu.");
    // Posle odbijenog predloga (otkazan) sme novi; dok jedan čeka kupca ili je potvrđen — ne.
    const [active] = [...(await tx.execute<{ n: string }>(sql`
      SELECT request_number AS n FROM customer_orders WHERE replaces_order_id = ${o.id}::uuid AND status <> 'cancelled' LIMIT 1`))];
    if (active) throw new Error(`Za ovaj zahtev već postoji predlog ${active.n}. Novi je moguć tek ako ga kupac odbije.`);
    const today = belgradeDate(new Date());
    const approved = await approvedPaymentOptions(o.customer_id, today, tx);
    if (o.payment_option && !approved.includes(o.payment_option)) throw new Error("Opcija plaćanja iz zahteva više nije odobrena — dogovorite novu sa kupcem.");
    const priced = await priceLines(tx, o.customer_id, items.map((i) => ({ ...i, packs: null })), o.payment_option, today, "office");
    const bad = priced.lines.filter((l) => l.problem || l.quantityProblem);
    if (bad.length) throw new Error(bad.map((l) => `${l.articleCode}: ${l.problem ?? l.quantityProblem}`).join("; "));
    const valid = priced.lines.filter((l) => l.amounts);
    const totals = orderTotals(valid.map((l) => ({ quantity: l.quantity, netPrice: (l.selected as { netPrice: number }).netPrice, vatPercent: (l.selected as { vatPercent: number }).vatPercent, listPrice: (l.selected as { listPrice: number }).listPrice, discountPercent: (l.selected as { discountPercent: number }).discountPercent })));
    // Original: u obradu (ako nije) pa „potrebna izmena“ sa razlogom — ostaje netaknut.
    if (o.status === "submitted") {
      await tx.execute(sql`UPDATE customer_orders SET status = 'under_review', reviewed_by = ${viewer.id}::uuid, reviewed_at = now(), updated_at = now() WHERE id = ${o.id}::uuid`);
      await statusEvent(tx, o.id, "submitted", "under_review", { staff: viewer }, null);
    }
    const [{ last }] = [...(await tx.execute<{ last: number }>(sql`
      SELECT coalesce(max(revision), ${o.revision})::int AS last FROM customer_orders WHERE replaces_order_id = ${o.id}::uuid`))];
    const rev = Math.max(o.revision, last) + 1;
    const number = `${o.request_number}/${rev}`;
    const why = `Kancelarija je pripremila izmenjen predlog ${number}: ${reason}`;
    if (o.status === "changes_requested") {
      await tx.execute(sql`UPDATE customer_orders SET status_reason = ${why}, decided_by = ${viewer.id}::uuid, decided_at = now(), updated_at = now() WHERE id = ${o.id}::uuid`);
    } else {
      const problem = transitionProblem({ from: "under_review", to: "changes_requested", actor: "office", reason: why });
      if (problem) throw new Error(problem);
      await tx.execute(sql`UPDATE customer_orders SET status = 'changes_requested', status_reason = ${why}, decided_by = ${viewer.id}::uuid, decided_at = now(), updated_at = now() WHERE id = ${o.id}::uuid`);
      await statusEvent(tx, o.id, "under_review", "changes_requested", { staff: viewer }, why);
    }
    const [nw] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO customer_orders (customer_id, submitted_by, prepared_by, request_number, status, idempotency_key, pricing_source, currency,
                                   net_total, vat_total, gross_total, customer_note, status_reason, replaces_order_id, payment_option, payment_option_label,
                                   delivery_address, contact_phone, on_request_lines, revision)
      VALUES (${o.customer_id}, NULL, ${viewer.id}::uuid, ${number}, 'awaiting_customer', ${randomUUID()}, 'cenovnik', 'RSD',
              ${totals.net}, ${totals.vat}, ${totals.gross}, ${o.customer_note}, ${reason}, ${o.id}::uuid, ${o.payment_option}, ${o.payment_option ? optionLabel(o.payment_option) : null},
              ${o.delivery_address}, ${o.contact_phone}, ${priced.lines.filter((l) => l.selected?.status === "na_upit").length}, ${rev})
      RETURNING id`))];
    await insertLines(tx, nw.id, priced.lines);
    await statusEvent(tx, nw.id, null, "awaiting_customer", { staff: viewer }, reason);
    await recordAudit(
      { actor: { id: viewer.id, name: viewer.name, role: viewer.role }, action: AUDIT_ACTIONS.orderRevisionProposed, entityType: "Zahtev za porudžbinu", entityId: nw.id, entityLabel: number, before: { original: o.request_number }, after: { stavki: priced.lines.length, verzija: rev }, reason },
      tx,
    );
    return { orderId: nw.id, requestNumber: number };
  });
}

/** Zahtev iz opsega kancelarije koji sme da dobije izmenjen predlog (bez upisa). */
async function revisableOrder(viewer: PortalUser, orderId: string) {
  if (!can(viewer, "customer_orders:review")) throw new Error("Nemate pravo da menjate zahteve.");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error("Zahtev ne postoji.");
  const scope = await resolveLedgerScope(viewer);
  const [o] = [...(await getDb().execute<{ id: string; customer_id: string; payment_option: string | null }>(sql`
    SELECT id, customer_id, payment_option FROM customer_orders WHERE id = ${orderId}::uuid AND pricing_source = 'cenovnik'`))];
  if (!o || (scope.customerIds !== null && !scope.customerIds.includes(o.customer_id))) throw new Error("Zahtev ne postoji.");
  return o;
}

/** Pretraga artikala za izmenjen predlog: šifra ili naziv, bez artikala van programa. */
export async function searchRevisionArticles(viewer: PortalUser, orderId: string, query: string) {
  await revisableOrder(viewer, orderId);
  const q = String(query ?? "").trim().slice(0, 60);
  if (q.length < 2) return [];
  const rows = await getDb().execute<{ code: string; name: string; unit: string | null }>(sql`
    SELECT a.code, a.name, a.unit FROM articles a
     WHERE ${foldedMatch([sql`a.code`, sql`a.name`], q)}
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
     ORDER BY (a.code = ${q}) DESC, a.name LIMIT 12`);
  return [...rows].map((r) => ({ code: r.code, name: r.name, unit: r.unit ?? "" }));
}

/** Pregled izmenjenog predloga pre slanja: cena po stavci za opciju iz zahteva, zbir. Ništa ne upisuje. */
export async function previewOrderRevision(viewer: PortalUser, orderId: string, items: { articleId: string; quantity: number }[]) {
  const o = await revisableOrder(viewer, orderId);
  const today = belgradeDate(new Date());
  const priced = await priceLines(getDb(), o.customer_id, items.filter((i) => i.quantity > 0).map((i) => ({ ...i, packs: null })), o.payment_option, today, "office");
  const lines = priced.lines.map((l) => ({
    code: l.articleCode,
    problem: l.problem ?? l.quantityProblem,
    status: l.selected?.status ?? null,
    netPrice: l.selected?.status === "cena" ? l.selected.netPrice : null,
    discountPercent: l.selected?.status === "cena" ? l.selected.discountPercent : null,
    /** Samo prikaz: osnovna cena iz cenovnika i iznosi stavke (isti `lineAmounts` kao zbir). */
    listPrice: l.selected?.status === "cena" ? l.selected.listPrice : null,
    net: l.amounts?.net ?? null,
    vat: l.amounts?.vat ?? null,
    gross: l.amounts?.gross ?? null,
    note: l.selected?.status === "na_upit" ? ON_REQUEST_NOTE[l.selected.reason] ?? "cenu potvrđuje kancelarija" : null,
    /** Pakovanje: obračun celih pakovanja, ili izuzetak koji će kupac videti. */
    packNote: !l.pack
      ? null
      : l.packs === null
        ? `Izuzetak: ${String(l.quantity).replace(".", ",")} ${l.unit} nije ceo broj pakovanja (${l.pack.label}) — kupac vidi izuzetak.`
        : l.packSummary,
    packException: Boolean(l.pack && l.packs === null),
  }));
  const gross = lines.reduce((sum, l) => sum + (l.gross ?? 0), 0);
  const net = lines.reduce((sum, l) => sum + (l.net ?? 0), 0);
  const vat = lines.reduce((sum, l) => sum + (l.vat ?? 0), 0);
  return {
    lines,
    gross: Math.round(gross * 100) / 100,
    net: Math.round(net * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    onRequest: lines.filter((l) => l.status === "na_upit").length,
  };
}

/** Kupac potvrđuje (postaje poslat zahtev; original „vraćen na ispravku“) ili odbija izmenjen predlog. */
export async function answerOrderRevision(session: CustomerSession, orderId: string, accept: boolean, expectedVersion?: string | null) {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  if (accept && session.assurance === "remembered") return { ok: false as const, message: "Radi sigurnosti, pre potvrde ponovo unesite lozinku." };
  if (!isUuid(orderId)) return { ok: false as const, message: "Predlog ne postoji." };
  const db = getDb();
  let accepted: Parameters<typeof notifyOrderSubmitted>[0] | null = null;
  const result = await db.transaction(async (tx) => {
    const [r] = [...(await tx.execute<{ id: string; status: string; replaces_order_id: string | null; request_number: string; on_request_lines: number; lines: number }>(sql`
      SELECT id, status::text AS status, replaces_order_id, request_number, on_request_lines,
             (SELECT count(*)::int FROM customer_order_lines l WHERE l.order_id = customer_orders.id) AS lines
        FROM customer_orders WHERE id = ${orderId}::uuid AND customer_id = ${customerId} FOR UPDATE`))];
    if (!r) return { ok: false as const, message: "Predlog ne postoji." };
    const stale = await staleVersionProblem(tx, r.id, expectedVersion);
    if (stale) return stale;
    if (r.status !== "awaiting_customer") return { ok: false as const, message: "Predlog više ne čeka potvrdu." };
    const to = accept ? "submitted" : "cancelled";
    const problem = transitionProblem({ from: "awaiting_customer", to, actor: "customer", reason: null });
    if (problem) return { ok: false as const, message: problem };
    await tx.execute(sql`UPDATE customer_orders SET status = ${to}::customer_order_status, submitted_by = ${session.accountId}::uuid, updated_at = now() WHERE id = ${r.id}::uuid`);
    await statusEvent(tx, r.id, "awaiting_customer", to, { customer: session }, accept ? "Kupac je potvrdio izmenjen predlog" : "Kupac je odbio izmenjen predlog");
    if (accept && r.replaces_order_id) {
      await tx.execute(sql`UPDATE customer_orders SET status = 'superseded', updated_at = now() WHERE id = ${r.replaces_order_id}::uuid AND status = 'changes_requested'`);
      await statusEvent(tx, r.replaces_order_id, "changes_requested", "superseded", { customer: session }, "Zamenjen potvrđenim izmenjenim predlogom");
    }
    if (accept) accepted = { orderId: r.id, requestNumber: r.request_number, customerName: session.customerName, lineCount: Number(r.lines), onRequest: Number(r.on_request_lines), revision: true };
    return { ok: true as const, message: accept ? "Potvrdili ste izmenjen zahtev. Kancelarija ga obrađuje." : "Odbili ste izmenjen predlog. Raniji zahtev ostaje sa statusom „Potrebna izmena“." };
  });
  if (accepted) await notifyOrderSubmitted(accepted);
  return result;
}
