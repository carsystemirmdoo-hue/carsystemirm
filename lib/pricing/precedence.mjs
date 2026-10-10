/**
 * Determinističko razrešavanje pravila cene — čista logika, bez baze.
 *
 * Ceo modul postoji zbog jedne rečenice: kada dva pravila iste klase važe za
 * isti dan i isti opseg, ishod je KONFLIKT, a ne izbor. Sistem koji u toj
 * situaciji uzme novije po `created_at` daje odgovor koji izgleda tačno, menja
 * se pri svakom uvozu i ne može se objasniti kupcu.
 */

/** Opseg kupca, od najužeg ka najširem. */
export const CUSTOMER_SCOPES = ["customer", "group", "all"];

/** Opseg proizvoda, od najužeg ka najširem. */
export const PRODUCT_SCOPES = ["article", "product_group", "brand", "all"];

export const VALUE_KINDS = ["discount_percent", "net_price"];

/**
 * Dvanaest klasa prvenstva, tačno onim redom kojim poslovanje odlučuje.
 *
 * Redosled je podatak, ne `if` lestvica: lestvica se menja tako da se ne
 * primeti, a niz se može ispisati u interfejsu i uporediti sa dogovorom.
 */
export const PRECEDENCE_LEVELS = [
  { level: 1, customerScope: "customer", productScope: "article", label: "Kupac + artikal" },
  { level: 2, customerScope: "customer", productScope: "product_group", label: "Kupac + grupa proizvoda" },
  { level: 3, customerScope: "customer", productScope: "brand", label: "Kupac + proizvođač" },
  { level: 4, customerScope: "customer", productScope: "all", label: "Kupac + svi proizvodi" },
  { level: 5, customerScope: "group", productScope: "article", label: "Grupa kupaca + artikal" },
  { level: 6, customerScope: "group", productScope: "product_group", label: "Grupa kupaca + grupa proizvoda" },
  { level: 7, customerScope: "group", productScope: "brand", label: "Grupa kupaca + proizvođač" },
  { level: 8, customerScope: "group", productScope: "all", label: "Grupa kupaca + svi proizvodi" },
  { level: 9, customerScope: "all", productScope: "article", label: "Svi kupci + artikal" },
  { level: 10, customerScope: "all", productScope: "product_group", label: "Svi kupci + grupa proizvoda" },
  { level: 11, customerScope: "all", productScope: "brand", label: "Svi kupci + proizvođač" },
  { level: 12, customerScope: "all", productScope: "all", label: "Globalno pravilo" },
];

const LEVEL_BY_SCOPE = new Map(
  PRECEDENCE_LEVELS.map((entry) => [
    `${entry.customerScope}|${entry.productScope}`,
    entry,
  ]),
);

export class PricingRuleError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "PricingRuleError";
    this.code = code;
  }
}

/**
 * Klasa prvenstva za dati par opsega.
 *
 * @param {{ customerScope: string, productScope: string }} scope
 * @returns {number} 1–12
 */
export function precedenceLevelFor(scope) {
  const found = LEVEL_BY_SCOPE.get(
    `${scope.customerScope}|${scope.productScope}`,
  );
  if (!found) {
    throw new PricingRuleError(
      `Nepoznat opseg pravila: ${scope.customerScope} + ${scope.productScope}.`,
      "unknown_scope",
    );
  }
  return found.level;
}

/** Čitljiv naziv klase, za interfejs i za objašnjenje odluke. */
export function precedenceLabelFor(level) {
  return PRECEDENCE_LEVELS.find((entry) => entry.level === level)?.label ?? null;
}

/**
 * Ključ konkretnog opsega.
 *
 * Dva pravila su „na istom opsegu" kada im je ovaj ključ jednak. Bez njega bi
 * „isti opseg" bilo poređenje četiri polja rasuto po pozivaocima, i svaka
 * varijanta tog poređenja bi negde bila napisana malo drugačije.
 *
 * @param {object} rule
 * @returns {string}
 */
export function scopeKeyFor(rule) {
  const customerPart =
    rule.customerScope === "customer"
      ? `customer:${required(rule.customerId, "customerId")}`
      : rule.customerScope === "group"
        ? `group:${required(rule.customerGroupId, "customerGroupId")}`
        : "all";

  const productPart =
    rule.productScope === "article"
      ? `article:${required(rule.articleId, "articleId")}`
      : rule.productScope === "product_group"
        ? `product_group:${required(rule.productGroup, "productGroup")}`
        : rule.productScope === "brand"
          ? `brand:${required(rule.brand, "brand")}`
          : "all";

  // Uslov plaćanja (0042) je deo opsega: uslovno i bezuslovno pravilo istog para nisu sukob.
  return rule.paymentCondition ? `${customerPart}|${productPart}|uslov:${rule.paymentCondition}` : `${customerPart}|${productPart}`;
}

function required(value, field) {
  if (value === null || value === undefined || value === "") {
    throw new PricingRuleError(
      `Opseg pravila zahteva polje ${field}.`,
      "missing_scope_field",
    );
  }
  return String(value);
}

/**
 * Da li je oblik pravila uopšte dopušten.
 *
 * Vraća razlog odbijanja ili `null`. Najvažnija provera: pravilo NE SME
 * istovremeno definisati i procenat rabata i fiksnu neto cenu. Takvo pravilo
 * nema jedan odgovor, pa bi svaki potrošač birao sam — i dva ekrana bi
 * prikazala dve cene za isti artikal.
 *
 * @param {object} rule
 * @returns {string | null}
 */
export function rejectRuleShape(rule) {
  if (!CUSTOMER_SCOPES.includes(rule.customerScope)) {
    return `Nepoznat opseg kupca „${rule.customerScope}".`;
  }
  if (!PRODUCT_SCOPES.includes(rule.productScope)) {
    return `Nepoznat opseg proizvoda „${rule.productScope}".`;
  }
  if (!VALUE_KINDS.includes(rule.valueKind)) {
    return `Nepoznata vrsta vrednosti „${rule.valueKind}".`;
  }

  const hasDiscount = rule.discountPercent !== null && rule.discountPercent !== undefined;
  const hasNetPrice = rule.netPrice !== null && rule.netPrice !== undefined;

  if (hasDiscount && hasNetPrice) {
    return "Pravilo ne sme istovremeno definisati i rabat i fiksnu neto cenu.";
  }
  if (rule.valueKind === "discount_percent" && !hasDiscount) {
    return 'Pravilo tipa „rabat" mora imati procenat.';
  }
  if (rule.valueKind === "net_price" && !hasNetPrice) {
    return 'Pravilo tipa „fiksna cena" mora imati neto cenu.';
  }
  if (hasDiscount) {
    const percent = Number(rule.discountPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return "Procenat rabata mora biti između 0 i 100.";
    }
  }
  if (hasNetPrice) {
    const price = Number(rule.netPrice);
    if (!Number.isFinite(price) || price < 0) {
      return "Neto cena ne sme biti negativna.";
    }
  }

  if (!rule.effectiveFrom) return "Pravilo mora imati datum od kada važi.";
  if (rule.effectiveTo && rule.effectiveTo < rule.effectiveFrom) {
    return 'Datum „važi do" ne sme biti pre datuma „važi od".';
  }

  try {
    scopeKeyFor(rule);
  } catch (error) {
    return error instanceof PricingRuleError ? error.message : String(error);
  }
  return null;
}

/**
 * Da li pravilo važi na dati dan.
 *
 * Granice su UKLJUČENE na oba kraja: pravilo koje važi „od 1. do 31." važi i
 * prvog i tridesetprvog. Poluotvoreni interval bi značio da se poslednji dan
 * tiho gubi, a to bi se primetilo tek na fakturi.
 *
 * @param {{ effectiveFrom: string, effectiveTo?: string | null }} rule
 * @param {string} onDate  `YYYY-MM-DD`
 */
export function isEffectiveOn(rule, onDate) {
  if (onDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo && onDate > rule.effectiveTo) return false;
  return true;
}

/**
 * Da li pravilo pokriva dati par (kupac, artikal).
 *
 * @param {object} rule
 * @param {object} context
 * @param {string} context.customerId
 * @param {readonly string[]} [context.customerGroupIds]
 * @param {string} context.articleId
 * @param {string | null} [context.productGroup]
 * @param {string | null} [context.brand]
 * @param {string} context.onDate
 */
export function ruleApplies(rule, context) {
  if (!isEffectiveOn(rule, context.onDate)) return false;
  // Uslovni rabat (0042) važi SAMO kada je uslov izabran i ispunjen; nikad podrazumevano.
  if (rule.paymentCondition && rule.paymentCondition !== (context.paymentCondition ?? null)) return false;

  switch (rule.customerScope) {
    case "customer":
      if (rule.customerId !== context.customerId) return false;
      break;
    case "group":
      if (!(context.customerGroupIds ?? []).includes(rule.customerGroupId)) {
        return false;
      }
      break;
    case "all":
      break;
    default:
      return false;
  }

  switch (rule.productScope) {
    case "article":
      return rule.articleId === context.articleId;
    case "product_group":
      // Tačno poklapanje naziva grupe iz izvora; bez normalizacije, jer bi
      // normalizacija spojila dve grupe koje knjigovodstvo vodi odvojeno.
      return Boolean(context.productGroup) && rule.productGroup === context.productGroup;
    case "brand":
      return Boolean(context.brand) && rule.brand === context.brand;
    case "all":
      return true;
    default:
      return false;
  }
}

/**
 * @template TRule
 * @typedef {object} PricingDecision
 * @property {TRule | null} winner  pravilo koje je pobedilo, ili `null`
 * @property {number | null} level  klasa prvenstva pobednika
 * @property {string | null} levelLabel
 * @property {(TRule & { level: number, scopeKey: string })[]} considered
 *   sva razmatrana pravila, poređana po prvenstvu
 * @property {string} reason  objašnjenje odluke, na srpskom
 * @property {(TRule & { level: number, scopeKey: string })[]} conflict
 *   pravila koja se sudaraju, ako ih ima
 * @property {string | null} effectiveFrom
 * @property {string | null} effectiveTo
 */

/**
 * Razrešava cenu za jedan par (kupac, artikal) na jedan dan.
 *
 * Vraća OBJAŠNJENJE, ne samo broj: koje je pravilo pobedilo, koja su bila u
 * igri, zašto je baš to pobedilo i da li postoji konflikt. Bez toga bi
 * komercijalista video cenu koju ne ume da obrazloži kupcu, a kancelarija ne bi
 * imala šta da uporedi sa BizniSoftom.
 *
 * @template {Record<string, any>} TRule
 * @param {readonly TRule[]} rules  pravila koja se UOPŠTE razmatraju
 * @param {object} context
 * @returns {PricingDecision<TRule>}
 */
export function evaluatePricing(rules, context) {
  const considered = [];

  for (const rule of rules ?? []) {
    if (!ruleApplies(rule, context)) continue;
    considered.push({
      ...rule,
      level: precedenceLevelFor(rule),
      scopeKey: scopeKeyFor(rule),
    });
  }

  if (considered.length === 0) {
    return {
      winner: null,
      level: null,
      levelLabel: null,
      considered: [],
      reason:
        "Nijedno pravilo ne pokriva ovaj par kupca i artikla na izabrani dan. Cena se ne izvodi iz pravila.",
      conflict: [],
      effectiveFrom: null,
      effectiveTo: null,
    };
  }

  /*
   * Sortiranje je isključivo po klasi prvenstva.
   *
   * `created_at` se NAMERNO ne koristi ni kao sekundarni kriterijum: čim bi
   * postojao, dva pravila iste klase bi dobila pobednika i konflikt se nikad ne
   * bi prijavio. Tiho razrešen konflikt je gori od prijavljenog.
   */
  considered.sort((a, b) => a.level - b.level);

  const bestLevel = considered[0].level;
  let atBestLevel = considered.filter((rule) => rule.level === bestLevel);
  // Izabran uslov plaćanja: na ISTOJ klasi uslovno pravilo ima prednost nad bezuslovnim
  // (uži opseg i dalje pobeđuje — npr. pojedinačni dogovor artikla nad uslovom za brend).
  if (context.paymentCondition && atBestLevel.some((r) => r.paymentCondition) && atBestLevel.some((r) => !r.paymentCondition)) {
    atBestLevel = atBestLevel.filter((r) => r.paymentCondition);
  }

  // „Isti opseg" je jednak `scopeKey`. Dva pravila iste klase na RAZLIČITIM
  // opsezima ne mogu oba važiti za isti par — ali ako se to ipak desi, i to je
  // konflikt, jer klasa prvenstva među njima ne razlikuje ništa.
  if (atBestLevel.length > 1) {
    return {
      winner: null,
      level: bestLevel,
      levelLabel: precedenceLabelFor(bestLevel),
      considered,
      reason:
        `Konflikt: ${atBestLevel.length} aktivna pravila iste klase prvenstva ` +
        `(${precedenceLabelFor(bestLevel)}) važe za isti dan. ` +
        "Sistem ne bira između njih — pravila mora razrešiti čovek.",
      conflict: atBestLevel,
      effectiveFrom: null,
      effectiveTo: null,
    };
  }

  const winner = atBestLevel[0];
  const nizih = considered.length - 1;

  return {
    winner,
    level: winner.level,
    levelLabel: precedenceLabelFor(winner.level),
    considered,
    reason:
      `Pobedilo pravilo klase ${winner.level} (${precedenceLabelFor(winner.level)}). ` +
      (nizih > 0
        ? `Nadjačano je ${nizih} šire pravilo/a, jer uži opseg ima prvenstvo.`
        : "Nijedno drugo pravilo ne pokriva ovaj par."),
    conflict: [],
    effectiveFrom: winner.effectiveFrom,
    effectiveTo: winner.effectiveTo ?? null,
  };
}

/**
 * Neto cena iz pobedničkog pravila.
 *
 * Vraća `null` kada pravila nema ili kada je ishod konflikt — nikad procenu.
 * Rabat i odstupanje cene se NE nazivaju „maržom": marža traži nabavnu cenu,
 * koju portal nema i za koju `docs/b2b/01-target-architecture.md` (AD-4)
 * izričito kaže da ne ide u cloud.
 *
 * @param {PricingDecision<any>} decision
 * @param {number | null} basePrice  cenovnička cena, ako postoji
 * @returns {{ netPrice: number | null, basis: string }}
 */
export function netPriceFrom(decision, basePrice) {
  if (!decision.winner) {
    return { netPrice: null, basis: "Nema pobedničkog pravila." };
  }
  const rule = decision.winner;

  if (rule.valueKind === "net_price") {
    return {
      netPrice: Number(rule.netPrice),
      basis: "Fiksna neto cena iz pravila; cenovnička cena se ne koristi.",
    };
  }

  if (basePrice === null || basePrice === undefined) {
    return {
      netPrice: null,
      basis:
        "Pravilo daje rabat, ali cenovnička cena nije dostupna iz trenutnog izvora, pa se neto cena ne može izvesti.",
    };
  }

  const percent = Number(rule.discountPercent);
  const net = Number(basePrice) * (1 - percent / 100);
  return {
    netPrice: Math.round(net * 10000) / 10000,
    basis: `Rabat ${percent}% na cenovničku cenu ${basePrice}.`,
  };
}
