/**
 * Od blokova sajta do proizvoda — pravila P1–P6 (vidi build-source.mjs).
 *
 * Čista funkcija bez I/O, da bi pravila imala testove nad malim fixture-ima.
 */

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const norm = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const slugify = (value) =>
  String(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Oznake uz tabelu koje sajt ponegde ostavi na turskom. */
const QUALIFIER_TRANSLATION = { sert: "Hard", "orta sert": "Medium Hard", yumuşak: "Soft", yumusak: "Soft" };

function normalizeQualifier(text) {
  const value = clean(text);
  const translated = QUALIFIER_TRANSLATION[value.toLocaleLowerCase("tr")];
  if (translated) return translated;
  // „SOFT” → „Soft”, „Hard Red” ostaje.
  return value === value.toUpperCase() ? value.charAt(0) + value.slice(1).toLowerCase() : value;
}

/** Oznaka koja je već u naslovu („Soft Velcro Backing Pad” + „SOFT”) ne ulazi u naziv drugi put. */
function effectiveQualifiers(title, qualifiers) {
  const words = new Set(norm(title).split(" "));
  return [...new Set(qualifiers.map(normalizeQualifier))].filter((qualifier) => !norm(qualifier).split(" ").every((word) => words.has(word)));
}

const cleanTitle = (title) => clean(title).replace(/[.\s]+$/, "");

/** Naslov bez vodeće reči linije („Plus Velcro Woolpad” u liniji Befar Plus). */
function titleWithoutLine(title, line) {
  if (line === "Befar Plus") return title.replace(/^(befar\s+)?plus\s+/i, "");
  if (line === "Turkuaz") return title;
  return title;
}

/** Naziv proizvoda iz reda tabele proizvoda; „Compound” u bloku „Turkuaz Compound - Turkuaz Polish” → „Turkuaz Compound”. */
function productRowName(blockTitle, productValue) {
  const value = cleanTitle(productValue);
  const part = cleanTitle(blockTitle)
    .split(/\s+-\s+/)
    .map(clean)
    .find((candidate) => norm(candidate).endsWith(norm(value)) && norm(candidate) !== norm(value));
  return part ?? value;
}

/** Turski naziv bez mere i dijakritika: „250gr. Oto Cilası” → „oto cilasi”. */
const trKey = (value) =>
  clean(value)
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/\d+\s?(gr|g|ml|lt)\.?/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();

/**
 * Slike proizvoda iz TABELE PROIZVODA: blok deli jednu galeriju, ali proizvođač svakom
 * slajdu daje naslov („Likit Pasta”, „Cila”, „Hare Giderici”). Slajd pripada proizvodu
 * čiji turski naziv sadrži naslov slajda ili obrnuto. Bez dokaza proizvod dobija celu
 * galeriju bloka (grupna fotografija) i oznaku `sharedGroupImages`.
 */
export function imagesForProductRow(blockImages, productTr) {
  const key = trKey(productTr);
  if (!key) return { images: blockImages, sharedGroupImages: true };
  const words = key.split(" ").filter((word) => word.length > 3);
  const own = blockImages.filter((image) => {
    const title = trKey(image.titleTr);
    return title && (title.includes(key) || key.includes(title) || words.some((word) => title.split(" ").some((part) => part.startsWith(word.slice(0, 4)) && word.startsWith(part.slice(0, 4)))));
  });
  return own.length ? { images: own, sharedGroupImages: false } : { images: blockImages, sharedGroupImages: true };
}

const COLOUR_WORDS = /\b(white|orange|black|yellow|blue|cream|burgundy|claret|red|green|grey|gray)\b/i;

const variantCollisionKey = (row) => [norm(row.colour), norm(row.size), norm(row.holes)].join("|");

/**
 * @param {any[]} blocks  `raw/website.generated.json → blocks` (EN)
 */
export function buildProducts(blocks) {
  const conflicts = [];

  /* -- 1. Jedinice: red tabele proizvoda (P1) ili ceo blok (P2) ------------------------- */
  const units = [];
  for (const block of [...blocks].sort((a, b) => a.blockKey.localeCompare(b.blockKey, "en", { numeric: true }))) {
    const productValues = [...new Set(block.rows.map((row) => norm(row.product)).filter(Boolean))];
    const base = { line: block.line ?? "Befar", blocks: [block.blockKey], pages: [block.pageKey], categories: [block.category].filter(Boolean), images: block.images, titleTr: block.titleTr };
    if (block.columns.includes("product") && productValues.length > 1) {
      for (const value of productValues) {
        const rows = block.rows.filter((row) => norm(row.product) === value);
        const own = imagesForProductRow(block.images, rows[0].productTr);
        units.push({ ...base, images: own.images, sharedGroupImages: own.sharedGroupImages, kind: "product-row", name: productRowName(block.title, rows[0].product), groupTitle: cleanTitle(block.title), qualifiers: [], rows, titleTr: rows[0].productTr ?? null });
      }
    } else {
      const title = titleWithoutLine(cleanTitle(block.title), base.line);
      units.push({ ...base, kind: "family", name: title, groupTitle: null, qualifiers: effectiveQualifiers(title, block.qualifiers), rawQualifiers: block.qualifiers, rows: block.rows });
    }
  }

  /* -- 2. Isti skup šifara na više stranica = isti proizvod (P6) --------------------------- */
  const merged = [];
  for (const unit of units) {
    const codes = unit.rows.map((row) => row.code).sort().join(",");
    const twin = merged.find((candidate) => candidate.codeKey === codes);
    if (!twin) {
      merged.push({ ...unit, codeKey: codes, names: [unit.name], allQualifiers: [unit.rawQualifiers ?? []] });
      continue;
    }
    twin.blocks.push(...unit.blocks);
    twin.pages = [...new Set([...twin.pages, ...unit.pages])];
    twin.categories = [...new Set([...twin.categories, ...unit.categories])];
    twin.images = [...twin.images, ...unit.images.filter((image) => !twin.images.some((known) => known.mediaId === image.mediaId))];
    twin.names.push(unit.name);
    twin.allQualifiers.push(unit.rawQualifiers ?? []);
  }
  for (const unit of merged) {
    const distinctNames = [...new Set(unit.names.map(norm))];
    if (distinctNames.length > 1) {
      // Naziv koji sadrži oznaku bloka („Premium”) je precizniji; inače duži naziv.
      const qualifierWords = unit.allQualifiers.flat().map(norm).filter(Boolean);
      const best = [...unit.names].sort((a, b) => {
        const score = (name) => qualifierWords.filter((word) => norm(name).includes(word)).length;
        return score(b) - score(a) || b.length - a.length || a.localeCompare(b);
      })[0];
      conflicts.push({ type: "SAME_CODES_DIFFERENT_TITLES", code: unit.rows[0].code, detail: `${unit.names.join(" ↔ ")} (${unit.blocks.join(", ")})`, resolution: `isti skup šifara = isti proizvod; naziv: „${best}”` });
      unit.name = best;
      unit.qualifiers = effectiveQualifiers(best, unit.allQualifiers.flat());
    }
    const qualifierSets = [...new Set(unit.allQualifiers.map((list) => list.map(normalizeQualifier).sort().join("+")))];
    if (unit.kind === "family" && qualifierSets.length > 1) {
      const counts = new Map();
      for (const set of unit.allQualifiers.map((list) => list.map(normalizeQualifier).sort().join("+"))) counts.set(set, (counts.get(set) ?? 0) + 1);
      conflicts.push({
        type: "SAME_CODES_DIFFERENT_QUALIFIER",
        code: unit.rows[0].code,
        detail: `${unit.name}: ${unit.blocks.map((key, index) => `${key} „${unit.allQualifiers[index].join(" ") || "—"}”`).join(" ↔ ")}`,
        resolution: "isti skup šifara naveden dvaput sa različitom oznakom tvrdoće; šifre su jedan proizvod, a oznaka se NE prenosi u naziv dok je proizvođač ne uskladi",
      });
      unit.qualifiers = [];
      unit.qualifierConflict = unit.allQualifiers.map((list) => list.join(" "));
    }
  }

  /* -- 3. Šifra u dve različite jedinice (delimično preklapanje) ---------------------------- */
  const ownerByCode = new Map();
  for (const unit of merged) {
    unit.rows = unit.rows.filter((row) => {
      const owner = ownerByCode.get(row.code);
      if (!owner) {
        ownerByCode.set(row.code, unit);
        return true;
      }
      conflicts.push({ type: "CODE_IN_DIFFERENT_PRODUCTS", code: row.code, detail: `„${owner.name}” (${owner.blocks[0]}) ↔ „${unit.name}” (${unit.blocks[0]})`, resolution: `šifra ostaje kod prvog proizvoda: „${owner.name}”` });
      return false;
    });
  }

  /* -- 4. Isti identitet, različite dimenzije → jedna porodica (P5) ------------------------- */
  const identityOf = (unit) => [unit.line, unit.kind, norm(unit.name), unit.qualifiers.map(norm).sort().join("+")].join("|");
  const families = [];
  for (const unit of merged.filter((candidate) => candidate.rows.length)) {
    const twin = families.find((candidate) => identityOf(candidate) === identityOf(unit) && !candidate.rows.some((row) => unit.rows.some((other) => variantCollisionKey(other) === variantCollisionKey(row))));
    if (!twin) {
      families.push({ ...unit });
      continue;
    }
    twin.rows = [...twin.rows, ...unit.rows];
    twin.blocks.push(...unit.blocks);
    twin.pages = [...new Set([...twin.pages, ...unit.pages])];
    twin.categories = [...new Set([...twin.categories, ...unit.categories])];
    twin.images = [...twin.images, ...unit.images.filter((image) => !twin.images.some((known) => known.mediaId === image.mediaId))];
    twin.groupTitles = [...new Set([...(twin.groupTitles ?? [twin.groupTitle]), unit.groupTitle].filter(Boolean))];
  }

  /* -- 4b. Isti EN naziv za dva RAZLIČITA proizvoda → turski naziv kao drugi zvanični svedok ---- */
  // Sajt ume da kopira EN naslov („Leo Premium Advance…” dvaput), dok turski original
  // razlikuje „Leo Premium Advance” od „Leo Plus Advance”. Reči linije se ne prevode, pa se
  // mogu uporediti između jezika.
  const LINE_WORDS = ["plus", "premium", "advance", "air", "lines", "orbital", "turkuaz", "extra"];
  const lineWordsOf = (text) => LINE_WORDS.filter((word) => norm(text).split(" ").includes(word));
  const byName = new Map();
  for (const family of families) byName.set(identityOf(family), [...(byName.get(identityOf(family)) ?? []), family]);
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    for (const family of group) {
      if (!family.titleTr) continue;
      const en = lineWordsOf(family.name);
      const tr = lineWordsOf(family.titleTr);
      const onlyEn = en.filter((word) => !tr.includes(word));
      const onlyTr = tr.filter((word) => !en.includes(word));
      if (onlyEn.length === 1 && onlyTr.length === 1) {
        const corrected = family.name.replace(new RegExp(`\\b${onlyEn[0]}\\b`, "i"), onlyTr[0].charAt(0).toUpperCase() + onlyTr[0].slice(1));
        conflicts.push({ type: "EN_TITLE_DUPLICATED_TR_TITLE_DIFFERS", code: family.rows[0].code, detail: `EN „${family.name}” stoji uz dva proizvoda; TR „${family.titleTr}”`, resolution: `naziv prema turskom originalu: „${corrected}”` });
        family.name = corrected;
      }
    }
  }

  /* -- 5. Zapis proizvoda ---------------------------------------------------------------------- */
  const usedKeys = new Set();
  const products = families.map((family) => {
    const officialName = [family.name, ...family.qualifiers].join(" · ");
    const linePrefix = family.line === "Befar" || norm(family.name).startsWith(norm(family.line)) ? "" : `${family.line} `;
    // Linija ulazi u ključ samo kada je naziv već ne nosi („Leo Hamburger Pad” → `leo-hamburger-pad`, ne `leo-leo-…`).
    let sourceKey = slugify(`${linePrefix}${family.name} ${family.qualifiers.join(" ")}`);
    if (usedKeys.has(sourceKey)) sourceKey = `${sourceKey}-${family.rows[0].code.toLowerCase()}`;
    usedKeys.add(sourceKey);
    const hasSet = /\bset\b/i.test(family.name);
    return {
      sourceKey,
      kind: family.kind,
      line: family.line,
      officialName,
      displayNameEn: `${linePrefix}${officialName}`.replace(/\s+/g, " ").trim(),
      title: family.name,
      titleTr: family.titleTr ?? null,
      qualifiers: family.qualifiers,
      qualifierConflict: family.qualifierConflict ?? null,
      groupTitles: family.groupTitles ?? [family.groupTitle].filter(Boolean),
      isSet: hasSet,
      categories: family.categories,
      pages: family.pages,
      blocks: family.blocks,
      variants: family.rows.map((row) => ({
        code: row.code,
        product: row.product,
        colour: row.colour,
        size: row.size,
        holes: row.holes,
        hardness: row.hardness,
        quantity: row.quantity,
        label: row.label,
        swatch: row.swatch,
      })),
      sharedGroupImages: Boolean(family.sharedGroupImages),
      // Grupna fotografija (naslov bez boje) ide prva; slajdovi pojedinačnih boja posle nje.
      images: [...family.images].sort((a, b) => Number(COLOUR_WORDS.test(a.title ?? "")) - Number(COLOUR_WORDS.test(b.title ?? ""))),
    };
  });

  products.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  return { products, conflicts };
}

/**
 * P7. Spojena ćelija boje: Wix ispisuje boju JEDNOM za celu tabelu (Woolpad: „White” uz jedan red).
 * Boja se prenosi na ostale redove samo kada je katalog potvrdi za bar jedan od njih i ne ospori
 * nijedan; bez potvrde ostali redovi ostaju bez boje. Očekuje varijante već ukrštene sa katalogom.
 */
export function applySpanningColour(product, catalogueTitle) {
  const stated = [...new Set(product.variants.map((variant) => variant.colour).filter(Boolean))];
  const unstated = product.variants.filter((variant) => !variant.colour);
  if (stated.length !== 1 || !unstated.length) return false;
  const witnesses = unstated.filter((variant) => variant.catalogue?.label);
  if (!witnesses.length || !witnesses.every((variant) => variant.catalogue.label.toLowerCase() === stated[0].toLowerCase())) return false;
  for (const variant of unstated) {
    variant.colour = stated[0];
    variant.colourSource = `spojena ćelija boje na sajtu; potvrda: ${catalogueTitle}, str. ${witnesses[0].catalogue.pdfPage}`;
  }
  return true;
}
