import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogEntityIdForProduct, getCatalogListingData } from "@/lib/catalog-listing";
import { getCarsystemProductBySlug, getProductVariantSelector } from "@/lib/carsystem-data";
import { resolveVariant, usualQuantity } from "@/lib/customers/reorderRules.mjs";
import { articleStats, enoughHistory, frequentOrder, refillCandidates } from "@/lib/customers/forYouRules.mjs";
import { loadArticleRequestPrices } from "@/lib/ordering/request-service";
import { isTrialCustomer, orderingEnabledFor } from "@/lib/ordering/trial";
import { isSinglePiece, suggestedPacks } from "@/lib/ordering/packRule.mjs";
import { getFamilyForProduct, variantRedirectTarget } from "@/lib/product-families";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { customerStockFor } from "@/lib/stock/stock-import-service";

/*
 * „Za Vas“ — kartice („Najčešće kupujete“, „Vreme je za dopunu“) i lični redosled kataloga.
 *
 * Izvor kupovina:
 *  - stvaran kupac: SAMO njegove potvrđene kupovine (`recommendation_input_lines`, isti izvor kao
 *    profil kupca);
 *  - demo kupac (system_settings `customer.demo`, npr. Posterium/PROBA): izolovana sintetička
 *    istorija iz tog podešavanja; cene iz pravila cena tog kupca (isti obračun kao korpa). Ne upisuje se u fakture, cenovnik ni izveštaje, ne
 *    meša se sa stvarnim podacima, i vidi je samo taj kupac (bira se po kupcu iz sesije).
 * Uvek: samo POTVRĐENA veza sa katalogom; bez opreme i artikala van programa.
 */

export const DEMO_SETTING = "customer.demo";

type DemoProfile = {
  label?: string;
  /** Sintetičke kupovine, relativno na danas (`daysAgo`), da demo ostane aktuelan. */
  events: { code: string; daysAgo: number; doc: string; qty: number }[];
  /** Zastarelo: ranije demo cene po JM. Cene se sada računaju kao u korpi (pravila cena kupca). */
  prices?: Record<string, number>;
};
type DemoSetting = { profiles?: Record<string, DemoProfile> };

export type ForYouCard = {
  articleId: string;
  entityId: string;
  name: string;
  href: string;
  image: { src: string; alt: string } | null;
  variantLabel: string | null;
  packLabel: string | null;
  /**
   * Cena iz ISTOG obračuna kao korpa, za svaku odobrenu opciju plaćanja (odloženo, avans…),
   * za celo potvrđeno pakovanje kada postoji. `kind: "demo"` samo označava demo kupca.
   */
  price:
    | { kind: "cena" | "demo"; unit: string; single: boolean; perUnit: boolean; byOption: { code: string | null; packNet: number | null; unitNet: number }[] }
    | null;
  stock: { state: "ima" | "nema" | "upit"; text: string } | { state: "zastareo"; text: string } | null;
  orderable: boolean;
  /** Predlog broja pakovanja iz uobičajene količine; null = kupac unosi (bez tihog zaokruživanja). */
  suggestedPacks: number | null;
  suggestionNote: string | null;
  reason: string | null;
};

export type ForYou = {
  demo: boolean;
  demoLabel: string | null;
  enoughHistory: boolean;
  frequent: ForYouCard[];
  refill: ForYouCard[];
  /** Lični redosled kataloga: kupovane stavke (1) i srodne (2); ostatak ostaje standardan. */
  ranking: { purchased: string[]; related: string[] };
};

const FREQUENT_LIMIT = 8;
const REFILL_LIMIT = 4;
const RELATED_LIMIT = 24;

/** Demo samo za izdvojenog TEST kupca (ordering.trial) — stvarna firma nikad ne dobija demo podatke. */
async function demoProfile(customerId: string): Promise<DemoProfile | null> {
  if (!(await isTrialCustomer(customerId))) return null;
  const [row] = [...(await getDb().execute<{ value: DemoSetting }>(sql`SELECT value FROM system_settings WHERE key = ${DEMO_SETTING}`))];
  const p = row?.value?.profiles?.[customerId];
  return p && Array.isArray(p.events) ? p : null;
}

type Event = { articleId: string; date: string; purchaseId: string; quantity: number; unit: string | null };

async function realEvents(customerId: string, today: string): Promise<Event[]> {
  const rows = await getDb().execute<{ article_id: string; d: string; doc: string; q: string; unit: string | null }>(sql`
    SELECT il.article_id, ril.issued_on::text AS d, ril.invoice_id::text AS doc, sum(il.quantity)::text AS q, max(btrim(a.unit)) AS unit
      FROM recommendation_input_lines ril
      JOIN invoice_lines il ON il.id = ril.invoice_line_id
      JOIN articles a ON a.id = il.article_id
     WHERE ril.customer_id = ${customerId} AND ril.issued_on <= ${today}::date
     GROUP BY il.article_id, ril.issued_on, ril.invoice_id`);
  return [...rows].map((r) => ({ articleId: r.article_id, date: r.d, purchaseId: r.doc, quantity: Number(r.q), unit: r.unit }));
}

async function demoEvents(profile: DemoProfile, today: string): Promise<Event[]> {
  const base = Date.parse(`${today}T00:00:00Z`);
  const dateOf = (daysAgo: number) => new Date(base - Math.max(0, Math.round(daysAgo)) * 86400000).toISOString().slice(0, 10);
  const codes = [...new Set(profile.events.map((e) => e.code))];
  if (!codes.length) return [];
  const ids = new Map([...(await getDb().execute<{ id: string; code: string; unit: string | null }>(sql`
    SELECT id, code, btrim(unit) AS unit FROM articles WHERE code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`))].map((r) => [r.code, r]));
  return profile.events.flatMap((e) => {
    const a = ids.get(e.code);
    return a ? [{ articleId: a.id, date: dateOf(e.daysAgo), purchaseId: `demo:${e.doc}`, quantity: Number(e.qty) || 0, unit: a.unit }] : [];
  });
}

type ArticleFacts = {
  id: string; code: string; unit: string | null; slug: string; variant: string | null;
  pack_quantity: string | null; pack_unit: string | null; pack_label: string | null;
};

/** Artikli sa potvrđenom vezom, u programu, bez opreme. */
async function offeredArticles(ids: string[]): Promise<Map<string, ArticleFacts>> {
  if (!ids.length) return new Map();
  const rows = await getDb().execute<ArticleFacts>(sql`
    SELECT a.id, a.code, a.unit, m.catalog_product_slug AS slug, m.catalog_variant_id AS variant,
           ps.pack_quantity::text AS pack_quantity, ps.unit AS pack_unit, ps.label AS pack_label
      FROM articles a
      JOIN article_catalog_mappings m ON m.article_id = a.id AND m.status = 'mapped' AND m.catalog_product_slug IS NOT NULL
      LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id
     WHERE a.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM internal_equipment e WHERE e.code_key = regexp_replace(a.code, '^0+(?=[0-9])', ''))`);
  return new Map([...rows].filter((r) => getCarsystemProductBySlug(r.slug)).map((r) => [r.id, r]));
}

function entityIdOf(slug: string) {
  const product = getCarsystemProductBySlug(slug);
  if (!product) return null;
  // Kartica kataloga (i kartica zapremine kada je serija podeljena, 2026-10-21).
  return catalogEntityIdForProduct(product) ?? product.slug;
}

function present(a: ArticleFacts) {
  const product = getCarsystemProductBySlug(a.slug)!;
  const selector = getProductVariantSelector(product);
  const variant = resolveVariant(a.variant, selector?.variants ?? []);
  const row = variant ? selector?.variants.find((v) => (v.sku ?? v.id) === variant.key) : null;
  // Postojeće slike: varijanta → proizvod → predstavnik porodice (ista serija, ista slika serije).
  const familyImage = getFamilyForProduct(product)?.representative?.productImage?.src;
  const src = [row?.image, product.productImage?.src, familyImage].find((x) => x && !/placeholder/i.test(x));
  return {
    name: product.name,
    href: variant ? `/proizvodi/${product.slug}?varijanta=${encodeURIComponent(variant.key)}` : (variantRedirectTarget(product) ?? `/proizvodi/${product.slug}`),
    image: src ? { src, alt: product.productImage?.alt ?? product.name } : null,
    variantLabel: variant?.label ?? null,
  };
}

/** Samo za kupca iz sesije (`customerId` NIKAD iz zahteva). */
export async function loadForYou(customerId: string, now = new Date()): Promise<ForYou> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const today = belgradeDate(now);
  const demo = await demoProfile(customerId);
  const events = demo ? await demoEvents(demo, today) : await realEvents(customerId, today);
  const empty: ForYou = { demo: Boolean(demo), demoLabel: demo ? (demo.label ?? "Demo podaci") : null, enoughHistory: false, frequent: [], refill: [], ranking: { purchased: [], related: [] } };
  if (!events.length) return empty;

  const stats = articleStats(events, today);
  const facts = await offeredArticles(stats.map((s) => s.articleId));
  const usable = stats.filter((s) => facts.has(s.articleId));
  const frequent = frequentOrder(usable);
  const refill = refillCandidates(usable).slice(0, REFILL_LIMIT);
  const shownIds = [...new Set([...frequent.slice(0, FREQUENT_LIMIT).map((s) => s.articleId), ...refill.map((r) => r.articleId)])];

  const ordering = await orderingEnabledFor(customerId);
  // Cene iz istog obračuna kao korpa (samo uz pravo poručivanja), i za demo kupca: demo rabati
  // tog kupca su obična pravila cena, pa „Za Vas“, kartica kataloga i korpa pokazuju isto.
  const [realPriced, stock] = await Promise.all([
    ordering ? loadArticleRequestPrices(customerId, shownIds) : Promise.resolve(null),
    customerStockFor(shownIds, now),
  ]);

  const card = (articleId: string, reason: string | null): ForYouCard => {
    const a = facts.get(articleId)!;
    const p = present(a);
    const packQty = a.pack_quantity ? Number(a.pack_quantity) : null;
    const unit = a.pack_unit ?? a.unit ?? "KOM";
    const single = packQty !== null ? isSinglePiece({ quantity: packQty, label: a.pack_label ?? "" }, unit) : true;
    let price: ForYouCard["price"] = null;
    const line = realPriced?.lines.get(articleId);
    if (line) {
      const byOption = realPriced!.options.flatMap((o) => {
        const p2 = line.byOption[o.key];
        return p2 && p2.status === "cena" ? [{ code: o.code, packNet: p2.packAmounts?.net ?? null, unitNet: p2.netPrice }] : [];
      });
      if (byOption.length) price = { kind: demo ? "demo" : "cena", unit: line.unit, single, perUnit: packQty !== null && packQty !== 1, byOption };
    }
    const realLine = realPriced?.lines.get(articleId);
    // Uobičajena količina (po kupovini, u JM) → broj CELIH pakovanja; bez tihog zaokruživanja.
    const usual = usualQuantity(events.filter((e) => e.articleId === articleId).map((e) => ({ quantity: e.quantity, units: [e.unit] })));
    const sameUnit = Boolean(usual && packQty && usual.unit?.toUpperCase() === unit.toUpperCase());
    const suggested = usual && sameUnit ? suggestedPacks(usual.low, packQty) : 1;
    const qty = (n: number) => String(n).replace(".", ",");
    const suggestionNote = suggested === null && usual && a.pack_label ? `Uobičajeno ste kupovali ${qty(usual.low)} ${unit}, a pakovanje je ${a.pack_label} — to nije ceo broj pakovanja. Unesite broj pakovanja.` : null;
    const st = stock.state === "svez" ? (stock.byArticle.get(articleId) ?? null) : stock.state === "zastareo" ? { state: "zastareo" as const, text: "Raspoloživost potvrđuje kancelarija." } : null;
    return {
      articleId,
      entityId: entityIdOf(a.slug) ?? a.slug,
      ...p,
      packLabel: a.pack_label,
      price,
      stock: st,
      orderable: Boolean(realLine && realLine.pack && !realLine.problem && !realLine.procurementOnly),
      suggestedPacks: suggested,
      suggestionNote,
      reason,
    };
  };

  // Lični redosled: kupovane stavke kataloga (po težini), zatim pribor iz potvrđenih parova i
  // stavke istog brenda i faze rada (katalog), u standardnom redosledu.
  const purchasedEntities = [...new Set(frequent.map((s) => entityIdOf(facts.get(s.articleId)!.slug)).filter((x): x is string => Boolean(x)))];
  const companions = await getDb().execute<{ slug: string }>(sql`
    SELECT DISTINCT m.catalog_product_slug AS slug
      FROM article_companions c
      JOIN article_catalog_mappings m ON m.article_id = c.companion_article_id AND m.status = 'mapped'
     WHERE c.revoked_at IS NULL
       AND c.article_id IN (${sql.join(usable.map((s) => sql`${s.articleId}::uuid`), sql`, `)})
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = c.companion_article_id)`);
  const companionEntities = [...companions].map((r) => (r.slug ? entityIdOf(r.slug) : null)).filter((x): x is string => Boolean(x));
  const canonical = getCatalogListingData().canonical;
  const purchasedSet = new Set(purchasedEntities);
  const contexts = new Set(canonical.filter((e) => purchasedSet.has(e.id)).map((e) => `${e.brandSlug}|${e.phaseSlug}`));
  const sameWork = canonical.filter((e) => !purchasedSet.has(e.id) && contexts.has(`${e.brandSlug}|${e.phaseSlug}`)).map((e) => e.id);
  const related = [...new Set([...companionEntities, ...sameWork])].filter((id) => !purchasedSet.has(id)).slice(0, RELATED_LIMIT);

  return {
    ...empty,
    enoughHistory: enoughHistory(events.filter((e) => facts.has(e.articleId))),
    // Isti artikal se ne prikazuje dvaput: ono što je „za dopunu“ ne ponavlja se u „najčešće“.
    frequent: frequent.filter((s) => !refill.some((r) => r.articleId === s.articleId)).slice(0, FREQUENT_LIMIT).map((s) => card(s.articleId, null)),
    refill: refill.map((r) => card(r.articleId, r.reason)),
    ranking: { purchased: purchasedEntities, related },
  };
}
