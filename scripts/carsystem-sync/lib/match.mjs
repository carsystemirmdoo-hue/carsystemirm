/**
 * Hijerarhijski matching: naš postojeći zapis ↔ zvanični Carsystem proizvod.
 *
 * Čista funkcija (bez I/O) da bi se pravila mogla testirati sa `node --test`.
 *
 * Lestvica dokaza, od najjačeg. Prvi nivo koji da JEDNOG kandidata odlučuje:
 *
 *   1. šifra artikla koju zapis sam nosi (sku / tabela varijanti)  → EXACT_MATCH
 *   2. EAN                                                           → (izvori ga ne objavljuju; nivo postoji, uvek prazan)
 *   3. raspon serije potvrđen u našim podacima (productNamedColors)  → HIGH_CONFIDENCE_MATCH
 *   4. naša slika ILI naš TDS je bajt-identičan zvaničnom + naziv/kôd → HIGH_CONFIDENCE_MATCH
 *      (sam identičan fajl nije dovoljan: generički zapis može da nosi
 *      pozajmljenu sliku — mora da ga potvrdi naziv ili kôd serije)
 *   5. jedinstven tačan normalizovan naziv, bez sukoba pakovanja     → HIGH_CONFIDENCE_MATCH
 *      …isti naziv, ali pakovanja se ne slažu                        → PROBABLE_MATCH
 *   6. samo identična slika, ili samo kôd serije sa 1 kandidatom     → PROBABLE_MATCH
 *   7. kôd serije sa više kandidata                                  → AMBIGUOUS
 *   8. ništa                                                         → LEGACY_NOT_IN_CATALOGUE
 *
 * Fuzzy sličnost naziva se NE koristi ni na jednom nivou: ili je naziv posle
 * normalizacije isti, ili nije dokaz. Slični nazivi („Multi Green” / „Multi
 * Green Changer”) su različiti proizvodi sa različitim šiframa.
 */

const STOP_WORDS = new Set([
  "carsystem", "cs", "git", "kit", "brusni", "brusna", "diskovi", "disk", "disc", "sanding", "serija",
  "series", "polyester", "putty", "der", "die", "das",
]);

/** Nemački ↔ engleski zvanični nazivi istog artikla („Elastic weiss” = „Elastic white”). */
const TOKEN_ALIASES = { weiss: "white", weiß: "white", schwarz: "black", grau: "grey", gruen: "green", grün: "green" };

const fold = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

export function nameTokens(value) {
  return fold(value)
    .replace(/([a-z])\.(\d)/g, "$1$2") // F.19 → f19
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !STOP_WORDS.has(token))
    .map((token) => TOKEN_ALIASES[token] ?? token)
    .sort();
}

const sameTokens = (a, b) => a.length > 0 && a.length === b.length && a.every((token, index) => token === b[index]);

/** Kôd serije u nazivu: „F19”, „P.25”, „X1500”. */
export function seriesCodes(value) {
  return [...fold(value).matchAll(/\b([a-z]{1,2})\.?(\d{2,4})\b/g)].map((match) => `${match[1]}${match[2]}`);
}

const weights = (values) =>
  new Set(
    values.flatMap((value) =>
      [...String(value).matchAll(/(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l)\b/gi)].map(
        (match) => `${Number(match[1].replace(",", "."))}${match[2].toLowerCase()}`,
      ),
    ),
  );

/**
 * @param {object} local zapis iz `loadLocalCarsystemProducts`
 * @param {object[]} sourceProducts source dataset
 * @param {Map<string,string>} primaryImageBySha sha256 zvaničnog primarnog packshota → sourceKey
 * @param {Map<string,string[]>} aliasesBySourceKey dodatni zvanični nazivi (DE izdanje sajta)
 * @param {Map<string,string>} tdsBySha sha256 zvaničnog TDS-a → sourceKey
 */
export function matchLocalProduct(local, sourceProducts, primaryImageBySha, aliasesBySourceKey = new Map(), tdsBySha = new Map()) {
  const evidence = [];
  const byKey = new Map(sourceProducts.map((product) => [product.sourceKey, product]));
  const owners = (articleNumbers) => [
    ...new Set(
      articleNumbers.flatMap((articleNumber) =>
        sourceProducts
          .filter((product) => product.articles.some((article) => article.articleNumber === articleNumber))
          .map((product) => product.sourceKey),
      ),
    ),
  ];
  const result = (classification, keys, extra = {}) => ({
    localSlug: local.slug,
    localName: local.name,
    classification,
    autoApply: classification === "EXACT_MATCH" || classification === "HIGH_CONFIDENCE_MATCH",
    sourceKeys: keys,
    candidates: keys.map((key) => ({
      sourceKey: key,
      officialName: byKey.get(key)?.officialName ?? null,
      subtitle: byKey.get(key)?.subtitle ?? null,
      sourceUrl: byKey.get(key)?.sourceUrl ?? null,
      articleNumbers: byKey.get(key)?.articles.map((article) => article.articleNumber) ?? [],
    })),
    evidence,
    ...extra,
  });

  // 1 — sopstvena šifra artikla
  if (local.ownArticleNumbers.length) {
    const keys = owners(local.ownArticleNumbers);
    evidence.push({ level: "article-number", articleNumbers: local.ownArticleNumbers, owners: keys });
    if (keys.length === 1) return result("EXACT_MATCH", keys);
    if (keys.length > 1) return result("SOURCE_CONFLICT", keys, { note: "Šifre zapisa pripadaju različitim zvaničnim proizvodima." });
  }

  // 3 — raspon serije iz naših potvrđenih podataka
  if (local.seriesArticleNumbers.length) {
    const keys = owners(local.seriesArticleNumbers);
    evidence.push({ level: "series-article-range", articleNumbers: local.seriesArticleNumbers, owners: keys });
    if (keys.length === 1) return result("HIGH_CONFIDENCE_MATCH", keys);
  }

  const localTokens = nameTokens(local.name);
  const localCodes = seriesCodes(local.name);
  const namesOf = (product) => [product.officialName, ...(aliasesBySourceKey.get(product.sourceKey) ?? [])];

  const exactName = sourceProducts.filter((product) => namesOf(product).some((name) => sameTokens(localTokens, nameTokens(name))));
  const codeHits = localCodes.length
    ? sourceProducts.filter((product) => localCodes.some((code) => seriesCodes(product.officialName).includes(code)))
    : [];

  // 4 — bajt-identičan zvanični packshot
  const imageKey = local.imageSha256 ? primaryImageBySha.get(local.imageSha256) : undefined;
  if (imageKey) {
    const corroborated =
      exactName.some((product) => product.sourceKey === imageKey) || codeHits.some((product) => product.sourceKey === imageKey);
    evidence.push({ level: "identical-official-packshot", sourceKey: imageKey, corroboratedByNameOrCode: corroborated });
    if (corroborated) return result("HIGH_CONFIDENCE_MATCH", [imageKey]);
  }

  // 4b — bajt-identičan zvanični tehnički list
  const tdsKey = (local.documentSha256s ?? []).map((sha) => tdsBySha.get(sha)).find(Boolean);
  if (tdsKey) {
    const corroborated =
      exactName.some((product) => product.sourceKey === tdsKey) || codeHits.some((product) => product.sourceKey === tdsKey);
    evidence.push({ level: "identical-official-tds", sourceKey: tdsKey, corroboratedByNameOrCode: corroborated });
    if (corroborated) return result("HIGH_CONFIDENCE_MATCH", [tdsKey]);
  }

  // 5 — jedinstven tačan naziv
  if (exactName.length === 1) {
    const candidate = exactName[0];
    const localWeights = weights(local.packages);
    const officialWeights = weights(candidate.articles.map((article) => article.specification ?? ""));
    const packageConflict = localWeights.size > 0 && ![...localWeights].some((weight) => officialWeights.has(weight));
    evidence.push({
      level: "exact-normalized-name",
      officialName: candidate.officialName,
      localPackages: [...localWeights],
      officialPackages: [...officialWeights],
      packageConflict,
    });
    return packageConflict
      ? result("PROBABLE_MATCH", [candidate.sourceKey], { note: "Naziv je isti, ali se naša pakovanja ne poklapaju sa zvaničnim." })
      : result("HIGH_CONFIDENCE_MATCH", [candidate.sourceKey]);
  }

  // 6 — samo slika
  if (imageKey) return result("PROBABLE_MATCH", [imageKey], { note: "Jedini dokaz je identična zvanična slika; naziv zapisa je generički." });

  // 6/7 — kôd serije
  if (codeHits.length) {
    evidence.push({ level: "series-code", codes: localCodes, candidates: codeHits.length });
    return codeHits.length === 1
      ? result("PROBABLE_MATCH", [codeHits[0].sourceKey])
      : result("AMBIGUOUS", codeHits.map((product) => product.sourceKey));
  }
  if (exactName.length > 1) {
    return result("AMBIGUOUS", exactName.map((product) => product.sourceKey));
  }

  evidence.push({ level: "none", note: "Nijedan zvanični proizvod ne deli šifru, sliku, tačan naziv ni kôd serije." });
  return result("LEGACY_NOT_IN_CATALOGUE", []);
}
