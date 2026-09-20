/**
 * Prevod zvaničnih SATA termina preko rečnika `localization/terms.sr.json`.
 *
 * Brojevi, jedinice i oznake proizvoda (RP, HVLP, „DIGITAL pro”, „I (Control)”, 1,3) prolaze
 * DOSLOVNO — ništa se ne preračunava i ne zaokružuje. Reč koju rečnik ne poznaje se ne pogađa:
 * vrednost se tada vraća kao neprevedena, pa je pozivalac izostavlja ili ostavlja u zvaničnom obliku.
 */

const UNIT = "(?:l\\/min|Nl\\/min|m³\\/h|l\\/h|bar|psi|mm|cm|m|g|kg|l|ml|cc|°C|W|V|Hz|dB\\(A\\)|dB|µm|msh|K|lx|lux|h|min|x)";
const NUMERIC = new RegExp(`^(?:[\\d\\s.,:\\-–/×"'()+<>≤≥~%°]|${UNIT}(?![a-z]))+$`, "i");
// Oznaka proizvoda, ne rečenica: „DIGITAL pro”, „I (Control)”, „SR”, „MaxLayer”, „10X40”.
const DESIGNATION = /^(?:[A-Z0-9][A-Z0-9.,+\-/()" ]*|I \(Control\)|O \(Speed\)|DIGITAL (?:pro|ready)|MaxLayer|cc)$/;
const KNOWN_TOKENS = /\b(?:QCC|RPS|LCS|UV|RP|HVLP|NPT|BSP|DIN|ISO|G|M\d+x[\d.,]+)\b/g;

export function createTranslator(terms) {
  const patterns = terms.patterns.map((entry) => ({ regex: new RegExp(entry.match, "g"), replace: entry.replace }));
  const omit = new Set(terms.omitValues);
  const documented = terms.sourceTermsUntranslated ?? {};
  // Zvanične oznake sklopova (npr. „BVD”) koje ostaju doslovno unutar prevedene vrednosti.
  const extraTokens = (terms.knownTokens ?? []).length ? new RegExp(`\\b(?:${terms.knownTokens.join("|")})\\b`, "g") : null;

  function value(raw) {
    const text = String(raw ?? "").trim();
    if (!text || omit.has(text)) return { text: null, translated: false, omitted: true };
    // Namerno neprevedeno (kod konfiguracije / nejasno značenje): zvanična vrednost, uz obrazloženje.
    if (Object.hasOwn(documented, text)) return { text, translated: false, documented: documented[text] };
    if (Object.hasOwn(terms.values, text)) return { text: terms.values[text], translated: true };
    if (NUMERIC.test(text) || DESIGNATION.test(text)) return { text, translated: true };
    // Zamene se obeležavaju, pa se proverava da li je išta nepoznato ostalo VAN njih.
    const kept = [];
    let marked = text;
    for (const { regex, replace } of patterns) marked = marked.replace(regex, () => `@@${kept.push(replace) - 1}@@`);
    let remainder = marked.replace(/@@\d+@@/g, " ").replace(KNOWN_TOKENS, " ");
    if (extraTokens) remainder = remainder.replace(extraTokens, " ");
    if (!kept.length || /[A-Za-zÄÖÜäöüß]{3,}/.test(remainder)) return { text, translated: false };
    return { text: marked.replace(/@@(\d+)@@/g, (_, index) => kept[Number(index)]), translated: true };
  }

  return {
    value,
    axis: (name) => terms.axes[name] ?? null,
    label: (name) => terms.labels[name] ?? null,
  };
}
