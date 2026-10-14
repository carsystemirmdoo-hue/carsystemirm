/**
 * Srpski zapis mera u tekstu za prikaz: „1.6 kg” → „1,6 kg”, „0.5 L” → „0,5 L”, „10.0 kg” → „10,0 kg”.
 *
 * Menja se SAMO broj sa decimalnom tačkom kome odmah sledi jedinica mere. Šifre artikala
 * („159.218”, „4-430-0400”) i hiljadarske tačke („1.000 otkidnih listova”) nemaju jedinicu
 * iza sebe pa ostaju netaknute. Izvorni podaci se ne menjaju; ovo je samo prikaz.
 */
const UNIT = "(?:kg|g|mg|l|L|ml|mL|cl|dl|mm|cm|m|µm|μm|bar|psi|%|°C|h|min|kom\\.?)";
const DECIMAL_BEFORE_UNIT = new RegExp(`(\\d)\\.(\\d{1,2})(?=\\s?${UNIT}(?![\\p{L}\\d]))`, "gu");

/** @param {string} text */
export function formatMeasureSr(text) {
  if (typeof text !== "string" || !text.includes(".")) return text;
  return text.replace(DECIMAL_BEFORE_UNIT, "$1,$2");
}
