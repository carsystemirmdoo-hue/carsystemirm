/**
 * Srpski zapis mera u tekstu za prikaz: „1.6 kg” → „1,6 kg”, „0.5 L” → „0,5 L”, „10.0 kg” → „10,0 kg”,
 * „1.4 -1.5 mm” → „1,4 -1,5 mm”, „9 x 3.5 mm” → „9 x 3,5 mm”.
 *
 * Menja se SAMO broj sa decimalnom tačkom (1–2 decimale) koji pripada meri: sam ili u opsegu/nizu
 * brojeva kome odmah sledi jedinica. Šifre artikala („159.218”, „4-430-0400”), hiljadarske tačke
 * („1.000 otkidnih listova”) i oznake modela bez jedinice („Coverall 2.0”, „RP 1.3”) ostaju netaknute.
 * Izvorni podaci se ne menjaju; ovo je samo prikaz.
 */
const UNIT = "(?:kg|g|mg|l|L|ml|mL|cl|dl|mm|cm|m|µm|μm|bar|psi|%|°C|h|min|kom\\.?)";
const NUMBER = "\\d+(?:[.,]\\d{1,2})?(?!\\d)";
const MEASURE_RUN = new RegExp(
  `(?<![\\p{L}\\d.,])${NUMBER}(?:\\s*(?:[-–/x×]\\s*)?${NUMBER})*\\s?${UNIT}(?![\\p{L}\\d])`,
  "gu",
);

/** @param {string} text */
export function formatMeasureSr(text) {
  if (typeof text !== "string" || !text.includes(".")) return text;
  return text.replace(MEASURE_RUN, (run) => run.replace(/(\d)\.(\d)/g, "$1,$2"));
}

/*
 * Izvorni tekst proizvođača na engleskom (SATA konfiguracije i zvanični nazivi) ostaje kakav jeste:
 * „pressurised cup gun with 1.0 l cup” nije srpski opis mere. Prepoznaje se po rečima koje se u
 * srpskim opisima ne javljaju.
 */
const ENGLISH_MARKERS =
  /\b(?:with|without|for|and|the|of|cup|long|hose|gun|wand|pressuri[sz]ed|nozzle|female|male|thread|included|spray|material|flow|control|screwable|ring|bottle|aluminium|suction|pot|paint|double|reducer|rolls|blue|black|reusable|hanging)\b/i;

/**
 * Navedeni tekst („Zvanični SATA naziv: „…”) se ne menja. Samo tipografski navodnici: prava
 * dvostruka crta je u ovim tekstovima oznaka inča (G 1/2"), ne navodnik.
 */
const QUOTED = /(„[^“”]*[“”]|“[^”]*”)/u;

/**
 * Srpski opis sa merama za prikaz: decimalni zarez u merama, ali bez diranja navedenih zvaničnih
 * naziva i engleskog izvornog teksta.
 * @param {string} text
 */
export function formatSerbianMeasureText(text) {
  if (typeof text !== "string" || !text.includes(".")) return text;
  const parts = text.split(QUOTED);
  const unquoted = parts.filter((_, index) => index % 2 === 0).join(" ");
  if (ENGLISH_MARKERS.test(unquoted)) return text;
  return parts.map((part, index) => (index % 2 === 0 ? formatMeasureSr(part) : part)).join("");
}
