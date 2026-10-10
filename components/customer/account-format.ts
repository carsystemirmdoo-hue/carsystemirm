/** Zajednički formati kupčevog naloga. */
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";

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
  return dmy(iso.slice(0, 10));
}

/** Datum i vreme: dd/mm/yyyy HH:mm (Beograd), isto kao u panelu kupca i kancelarije. */
export function srDateTime(at: Date | null): string {
  if (!at) return "—";
  return dmyTime(at);
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
