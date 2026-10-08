/** Zajednički formati kupčevog naloga. */

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  faktura: "Faktura",
  povrat_robe: "Povrat robe",
  storno: "Storno",
  knjizno_odobrenje: "Knjižno odobrenje",
  korekcija_cene: "Korekcija cene",
  korekcija_popusta: "Korekcija popusta",
  nepoznato: "Dokument",
};

export function srDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)}. ${Number(m)}. ${y}.`;
}

export function srDateTime(at: Date | null): string {
  if (!at) return "—";
  return new Date(at).toLocaleString("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function srMoney(value: string | null, currency: string | null = "RSD"): string {
  if (value === null) return "—";
  return `${money.format(Number(value))} ${currency ?? "RSD"}`;
}

const qty = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });
export function srQuantity(value: string): string {
  return qty.format(Number(value));
}
