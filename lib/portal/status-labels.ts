/**
 * Nazivi i tonovi stanja koja uvodi komercijalna faza.
 *
 * Na jednom mestu, jer isto stanje mora izgledati isto na svakom ekranu.
 * Kada bi svaki ekran imao svoj prevod, `approved_pending_biznisoft` bi
 * ponegde postao samo „odobreno" — a upravo razlika između odobrenog i
 * potvrđenog je ono što ovaj model čuva.
 */

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export const PRICE_RULE_STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  pending_approval: "Čeka odobrenje",
  approved_pending_biznisoft: "Odobreno — čeka upis u BizniSoft",
  office_recorded: "Kancelarija evidentirala primenu — nije potvrđeno fakturom",
  confirmed: "Potvrđeno fakturom",
  rejected: "Odbijeno",
  reconciliation_failed: "Usaglašavanje nije uspelo",
  revoked: "Opozvano",
  expired: "Isteklo",
};

export const PRICE_RULE_STATUS_TONES: Record<string, Tone> = {
  draft: "neutral",
  pending_approval: "info",
  // Namerno `warning`, ne `success`: odobreno nije primenjeno, i boja to mora
  // reći pre nego što neko pročita tekst.
  approved_pending_biznisoft: "warning",
  /*
   * `warning`, ne `success`. Evidencija kancelarije je tvrdnja čoveka; boja ne
   * sme sugerisati dokaz koji ne postoji.
   */
  office_recorded: "warning",
  confirmed: "success",
  rejected: "neutral",
  reconciliation_failed: "danger",
  revoked: "neutral",
  expired: "neutral",
};

export const EXTERNAL_IDENTITY_LABELS: Record<string, string> = {
  unmapped: "Nije povezano",
  mapped: "Povezano",
  conflict: "Konflikt",
  disabled: "Isključeno",
};

export const EXTERNAL_IDENTITY_TONES: Record<string, Tone> = {
  unmapped: "info",
  mapped: "success",
  conflict: "danger",
  disabled: "neutral",
};

export const PRODUCT_MAPPING_LABELS: Record<string, string> = {
  unmapped: "Nije mapiran",
  suggested: "Predložena veza",
  mapped: "Potvrđena veza",
  conflict: "Konflikt",
  rejected: "Odbijen predlog",
  revoked: "Poništena veza",
};

export const PRODUCT_MAPPING_TONES: Record<string, Tone> = {
  unmapped: "info",
  // Predlog nije uspeh — dok ga čovek ne potvrdi, ne otvara ni sliku ni PDP.
  suggested: "warning",
  mapped: "success",
  conflict: "danger",
  rejected: "neutral",
  revoked: "warning",
};

export const CUSTOMER_ACCOUNT_LABELS: Record<string, string> = {
  requested: "Zatražen pristup",
  approved: "Otvoren — bez prve prijave",
  active: "Aktivan",
  suspended: "Isključen",
  rejected: "Odbijen",
};

export const CUSTOMER_ACCOUNT_TONES: Record<string, Tone> = {
  requested: "info",
  approved: "warning",
  active: "success",
  suspended: "danger",
  rejected: "neutral",
};

export const NOTIFICATION_SEVERITY_TONES: Record<string, Tone> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

export const NOTIFICATION_KIND_LABELS: Record<string, string> = {
  price_rule_proposed: "Predlog promene cene",
  price_rule_approved: "Odobrena promena cene",
  price_rule_rejected: "Odbijen predlog cene",
  price_rule_conflict: "Konflikt pravila cene",
  price_rule_reconciliation_failed: "Cena nije potvrđena u BizniSoftu",
  price_rule_revoked: "Opozvano pravilo cene",
  mapping_customer_facing_changed: "Promena vidljiva kupcu",
  external_identity_conflict: "Konflikt šifre partnera",
  customer_account_status_changed: "Promena kupčevog naloga",
};

/** Opis opsega pravila, čitljiv bez poznavanja modela. */
export function describeScope(rule: {
  customerScope: string;
  customerName?: string | null;
  customerGroupName?: string | null;
  productScope: string;
  articleCode?: string | null;
  articleName?: string | null;
  productGroup?: string | null;
  brand?: string | null;
}): string {
  const customer =
    rule.customerScope === "customer"
      ? (rule.customerName ?? "kupac")
      : rule.customerScope === "group"
        ? `grupa „${rule.customerGroupName ?? "?"}"`
        : "svi kupci";

  const product =
    rule.productScope === "article"
      ? `artikal ${rule.articleCode ?? "?"}${rule.articleName ? ` (${rule.articleName})` : ""}`
      : rule.productScope === "product_group"
        ? `grupa proizvoda „${rule.productGroup ?? "?"}"`
        : rule.productScope === "brand"
          ? `proizvođač „${rule.brand ?? "?"}"`
          : "svi proizvodi";

  return `${customer} · ${product}`;
}

/** Vrednost pravila kao tekst, sa jedinicom. */
export function describeValue(rule: {
  valueKind: string;
  discountPercent?: string | number | null;
  netPrice?: string | number | null;
  currency?: string | null;
}): string {
  if (rule.valueKind === "net_price") {
    return `Fiksna neto cena ${rule.netPrice} ${rule.currency ?? "RSD"}`;
  }
  return `Rabat ${rule.discountPercent}%`;
}

/**
 * Stanja izvornog PDF dokumenta.
 *
 * `unsupported_requires_sample` namerno nije „greška": dokument je možda
 * savršeno ispravan, samo za njegov oblik ne postoji potvrđen uzorak. Boja to
 * mora razlikovati od pokvarenog fajla, inače će neko počеti da „popravlja"
 * dokumente koji nisu pokvareni.
 */
export const SOURCE_DOCUMENT_VALIDATION_LABELS: Record<string, string> = {
  valid: "Pročitano i provereno",
  totals_mismatch: "Zbir se ne poklapa",
  unparsable: "Nije pročitano",
  unsupported_requires_sample: "Oblik bez potvrđenog uzorka",
};

export const SOURCE_DOCUMENT_VALIDATION_TONES: Record<string, Tone> = {
  valid: "success",
  totals_mismatch: "danger",
  unparsable: "danger",
  unsupported_requires_sample: "info",
};

export const SOURCE_DOCUMENT_REVISION_LABELS: Record<string, string> = {
  original: "Važeća verzija",
  superseded: "Zamenjeno novijom verzijom",
  conflict: "Sudar — čeka odluku",
  pending_review: "Čeka pregled",
};

export const SOURCE_DOCUMENT_REVISION_TONES: Record<string, Tone> = {
  original: "success",
  superseded: "neutral",
  conflict: "danger",
  pending_review: "warning",
};

export const MANUAL_REVIEW_LABELS: Record<string, string> = {
  not_required: "Nije potreban",
  pending: "Čeka pregled",
  resolved: "Pregledano",
};

export const MANUAL_REVIEW_TONES: Record<string, Tone> = {
  not_required: "neutral",
  pending: "warning",
  resolved: "success",
};

/**
 * Ishodi usaglašavanja pravila cene sa fakturom.
 *
 * `not_applicable` nije neuspeh — opseg pravila je širi od onoga što jedna
 * stavka fakture može da dokaže.
 */
export const RECONCILIATION_OUTCOME_LABELS: Record<string, string> = {
  confirmed: "Potvrđeno sa fakture",
  failed: "Uslov nije pronađen na fakturi",
  no_evidence_yet: "Još nema fakturisane stavke",
  not_applicable: "Opseg se ne dokazuje jednom stavkom",
  not_eligible: "Nije u fazi za usaglašavanje",
};

export const RECONCILIATION_OUTCOME_TONES: Record<string, Tone> = {
  confirmed: "success",
  failed: "danger",
  no_evidence_yet: "info",
  not_applicable: "warning",
  not_eligible: "neutral",
};
