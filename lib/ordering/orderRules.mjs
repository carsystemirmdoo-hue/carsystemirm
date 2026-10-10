import { lineNetCents, lineVatCents, unitNetCents } from "../pricing/money.mjs";
/**
 * Poručivanje — čista pravila, bez baze i bez Reacta.
 *
 *   - iznos: cena bez PDV-a, rabat, PDV i ukupno, zaokruženo na paru po stavci;
 *   - količina: celina iz cenovnika (najmanja količina i korak);
 *   - poručivost artikla: potvrđena veza, tačna varijanta, stavka cenovnika;
 *   - prelazi statusa zahteva i ko sme koji.
 *
 * Istorijska fakturisana cena ovde ne postoji ni kao ulaz. Jedini izvor cene
 * je stavka AKTIVNOG cenovnika, uz rabat kupca iz istog cenovnika.
 */

/** Najveća količina jedne stavke; iznad toga je greška u unosu, ne porudžbina. */
export const MAX_LINE_QUANTITY = 9999;

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Jedinična cena bez PDV-a posle rabata, zaokružena na paru.
 * @param {number} listPrice
 * @param {number} discountPercent
 */
export function netUnitPrice(listPrice, discountPercent = 0) {
  // Kao BizniSoft: tačno, tačna polovina pare naniže (vidi lib/pricing/money.mjs).
  return unitNetCents(String(listPrice), String(discountPercent)) / 100;
}

/**
 * Iznosi jedne stavke. PDV se računa na iznos stavke, ne na jediničnu cenu.
 *
 * Sa `listPrice` (i `discountPercent`) iznos se računa TAČNO kao BizniSoft
 * faktura: količina × osnovna cena × (1 − rabat), polovina pare naniže
 * (`lib/pricing/money.mjs`, poklapa se sa 80.346 od 80.350 stavki). Bez njih
 * (stari pozivi): količina × već zaokružena neto jedinična cena.
 * @param {{ quantity: number, netPrice: number, vatPercent: number, listPrice?: number | null, discountPercent?: number | null }} line
 */
export function lineAmounts(line) {
  const netCents =
    line.listPrice !== undefined && line.listPrice !== null
      ? lineNetCents({ quantity: String(line.quantity), price: String(line.listPrice), discountPercent: String(line.discountPercent ?? 0) })
      : Math.round(round2(Number(line.quantity) * Number(line.netPrice)) * 100);
  const vatCents = lineVatCents(netCents, String(line.vatPercent));
  return { net: netCents / 100, vat: vatCents / 100, gross: (netCents + vatCents) / 100 };
}

/** Zbir stavki. Ukupno je zbir zaokruženih stavki — isto što kancelarija sabira. */
export function orderTotals(lines) {
  let net = 0;
  let vat = 0;
  for (const line of lines) {
    const a = lineAmounts(line);
    net += a.net;
    vat += a.vat;
  }
  return { net: round2(net), vat: round2(vat), gross: round2(net + vat) };
}

/**
 * Da li je količina dozvoljena za stavku cenovnika. Vraća poruku ili `null`.
 * @param {unknown} raw
 * @param {{ minQuantity?: number, quantityStep?: number }} [item]
 */
export function quantityProblem(raw, item = {}) {
  const q = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(q) || q <= 0) return "Količina mora biti pozitivan broj.";
  if (q > MAX_LINE_QUANTITY) return `Najveća količina po stavci je ${MAX_LINE_QUANTITY}.`;
  const min = Number(item.minQuantity ?? 1);
  const step = Number(item.quantityStep ?? 1);
  if (q < min) return `Najmanja količina je ${min}.`;
  // Poređenje u hiljaditim delovima: 0,1 + 0,2 ne sme pasti na koraku 0,1.
  const units = Math.round(q * 1000);
  const stepUnits = Math.round(step * 1000);
  if (stepUnits > 0 && units % stepUnits !== 0) return `Količina ide u koracima od ${step}.`;
  return null;
}

export function parseQuantity(raw) {
  const q = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  return Math.round(q * 1000) / 1000;
}

/**
 * Zašto artikal NIJE poručiv, ili `null` kada jeste.
 *
 * Redosled je redosled otklanjanja: prvo veza sa katalogom, pa varijanta, pa
 * cena. Poruka je za kupca; `code` je za testove i kancelariju.
 *
 * @param {{
 *   mapping: { status: string, catalogProductSlug: string | null, catalogVariantId: string | null } | null,
 *   productExists: boolean,
 *   rowVariantKeys: string[],
 *   priceItem: object | null,
 *   pricingConflict?: boolean,
 *   rebateUnknown?: boolean,
 *   outOfProgramme?: boolean,
 * }} input
 * @returns {{ code: string, message: string } | null}
 */
export function orderabilityProblem(input) {
  // Van programa (0040): istorija ostaje, ali se artikal ne nudi ni ne poručuje.
  if (input.outOfProgramme) {
    return { code: "not_in_programme", message: "Artikal nije u aktuelnoj ponudi." };
  }
  const m = input.mapping;
  if (!m || m.status !== "mapped" || !m.catalogProductSlug) {
    return { code: "not_mapped", message: "Artikal nije potvrđeno povezan sa katalogom." };
  }
  if (!input.productExists) {
    return { code: "product_missing", message: "Proizvod više nije u katalogu." };
  }
  const keys = (input.rowVariantKeys ?? []).map((k) => k.toLowerCase());
  if (m.catalogVariantId) {
    if (!keys.includes(m.catalogVariantId.toLowerCase())) {
      return { code: "invalid_variant", message: "Varijanta iz veze ne postoji u katalogu." };
    }
  } else if (keys.length > 1) {
    return { code: "variant_required", message: "Veza ne određuje varijantu proizvoda." };
  }
  if (!input.priceItem) {
    return { code: "no_price", message: "Artikal nije u važećem cenovniku." };
  }
  if (input.pricingConflict) {
    return { code: "price_conflict", message: "Uslovi cene su u sukobu; kancelarija mora da ih razreši." };
  }
  // Nepoznat rabat nije 0 %: puna cenovnička cena se ne prikazuje kao dogovorena.
  if (input.rebateUnknown) {
    return { code: "rebate_unknown", message: "Cena na upit: Vaš rabat za ovaj artikal još nije potvrđen." };
  }
  return null;
}

/**
 * Otisak ponude: šta je kupac video. Cena se NE šalje iz pregledača — šalje se
 * samo ovaj otisak, a server ga poredi sa ponovo izračunatom ponudom.
 * @param {{ articleId: string, quantity: number, netPrice: number, vatPercent: number }[]} lines
 */
export function quoteKey(lines) {
  return [...lines]
    .map((l) => `${l.articleId}|${Number(l.quantity).toFixed(3)}|${Number(l.netPrice).toFixed(2)}|${Number(l.vatPercent).toFixed(2)}`)
    .sort()
    .join(";");
}

/* ---------------------------------------------------------------------------
 * Statusi
 * ------------------------------------------------------------------------ */

export const ORDER_STATUS_LABELS = {
  submitted: "Zahtev poslat",
  under_review: "U obradi",
  changes_requested: "Potrebna izmena",
  confirmed: "Potvrđena porudžbina",
  rejected: "Odbijen",
  cancelled: "Otkazan",
  superseded: "Vraćen na ispravku",
  awaiting_customer: "Izmenjen predlog — čeka Vašu potvrdu",
};

/** Kratko objašnjenje za kupca: šta status znači i šta sledi. */
export const ORDER_STATUS_HELP = {
  submitted: "Zahtev je primljen. Kancelarija će ga pregledati; ovo još nije potvrđena porudžbina.",
  under_review: "Kancelarija proverava artikle, količine i cene.",
  changes_requested: "Kancelarija traži izmenu. Pogledajte razlog; zahtev možete otkazati i poslati nov.",
  confirmed: "Kancelarija je potvrdila porudžbinu. Broj porudžbine je ispod.",
  rejected: "Kancelarija je odbila zahtev. Razlog je ispod.",
  cancelled: "Zahtev je otkazan.",
  superseded:
    "Stavke su vraćene u korpu radi ispravke koju je tražila kancelarija. Ispravljen zahtev dobija nov broj; ovaj ostaje u istoriji.",
};

/**
 * Dozvoljeni prelazi: `od → do` i ko sme.
 * `reason: true` znači da je razlog obavezan.
 */
export const ORDER_TRANSITIONS = [
  { from: "submitted", to: "under_review", actor: "office", reason: false },
  { from: "submitted", to: "cancelled", actor: "customer", reason: false },
  { from: "under_review", to: "confirmed", actor: "office", reason: false },
  { from: "under_review", to: "changes_requested", actor: "office", reason: true },
  { from: "under_review", to: "rejected", actor: "office", reason: true },
  // Ispravka ide kroz NOV zahtev: kupac vraća stavke u korpu (ovaj ostaje u istoriji)…
  { from: "changes_requested", to: "superseded", actor: "customer", reason: false },
  // …ili odustaje.
  { from: "changes_requested", to: "cancelled", actor: "customer", reason: false },
  // Izmenjen predlog kancelarije (0044): kupac ga potvrđuje (postaje poslat zahtev) ili odbija.
  { from: "awaiting_customer", to: "submitted", actor: "customer", reason: false },
  { from: "awaiting_customer", to: "cancelled", actor: "customer", reason: false },
];

/**
 * Da li je prelaz dozvoljen. Vraća poruku odbijanja ili `null`.
 * Isti prelaz koji je već izvršen nije greška — pozivalac ga tretira kao no-op.
 */
export function transitionProblem({ from, to, actor, reason }) {
  const rule = ORDER_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!rule) {
    return `Prelaz „${ORDER_STATUS_LABELS[from] ?? from}" → „${ORDER_STATUS_LABELS[to] ?? to}" nije dozvoljen.`;
  }
  if (rule.actor !== actor) return "Ovaj prelaz ne pripada Vašoj ulozi.";
  if (rule.reason && (!reason || String(reason).trim().length < 5)) {
    return "Razlog je obavezan (najmanje 5 znakova).";
  }
  return null;
}

export function formatRequestNumber(year, seq) {
  return `Z-${year}-${String(seq).padStart(5, "0")}`;
}

export function formatOrderNumber(year, seq) {
  return `P-${year}-${String(seq).padStart(5, "0")}`;
}
