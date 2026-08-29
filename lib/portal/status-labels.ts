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
  rejected: "Odbijeno",
};

export const PRODUCT_MAPPING_TONES: Record<string, Tone> = {
  unmapped: "info",
  // Predlog nije uspeh — dok ga čovek ne potvrdi, ne otvara ni sliku ni PDP.
  suggested: "warning",
  mapped: "success",
  conflict: "danger",
  rejected: "neutral",
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
