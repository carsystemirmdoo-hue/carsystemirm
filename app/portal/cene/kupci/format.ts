/** Prikaz za cene po kupcu: dd/mm/gggg, iznosi sa tačkom za hiljade i zarezom, rabat do 3 decimale. */
const MONEY = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? "—" : MONEY.format(cents / 100));
export const pctNum = (p: number | null | undefined) => (p === null || p === undefined ? "—" : String(Number(p.toFixed(3))).replace(".", ","));
export const pct = (p: number | null | undefined) => (p === null || p === undefined ? "—" : `${pctNum(p)} %`);
export const dmy = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/** Ključ boje opcije: odloženo plavo, avans zeleno, osnovni uslov neutralno. */
export const optKey = (code: string | null) => (code === "avans" ? "av" : code && code.startsWith("odlozeno_") ? "odl" : "nn");

/** Kratak natpis kolone: „ODLOŽENO · 30 DANA“, „AVANS“, „OSNOVNI USLOV“. */
export function optShort(code: string | null) {
  if (code === "avans") return "Avans";
  const m = code?.match(/^odlozeno_(\d+)$/);
  if (m) return `Odloženo · ${m[1]} dana`;
  return "Osnovni uslov";
}
