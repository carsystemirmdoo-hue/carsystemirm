/**
 * Sintetički skup od 3.500+ zapisa za testove i benchmark.
 *
 * Stvarni katalog danas ima 873 zapisa — dovoljno da pretraga bude tačna, ali
 * premalo da dokaže da ostaje brza i objašnjiva na skupu za koji je pravljena.
 * Fixture zato namerno pravi baš one oblike koji lome naivnu pretragu:
 *
 *   - porodice sa po 40+ varijanti i skoro identičnim nazivima;
 *   - isti naziv proizvoda kod različitih brendova;
 *   - jedinstvene SKU oznake usred stotina sličnih naziva;
 *   - ista boja u više pakovanja (`400 ml`, `1 l`, `3,5 l`);
 *   - dijakritiku i `đ`.
 *
 * Generator je deterministički (LCG sa fiksnim seed-om), pa dva pokretanja daju
 * bajt-identičan skup i benchmark brojevi su uporedivi.
 */

const BRANDS = [
  ["cosmos-lac", "Cosmos Lac"],
  ["rm", "R-M"],
  ["carsystem", "Carsystem"],
  ["baslac", "BASLAC"],
  ["carfit", "Carfit"],
  ["norbin", "Norbin"],
];

const FAMILY_WORDS = [
  "Automotive Antichip",
  "Fast Acrylic",
  "Master Mechanic Primer",
  "Molotow Burner",
  "Spray.Bike Finish",
  "Chalk Effect",
  "Wood Care Varnish",
  "Lubricants Grease",
  "Cleaners Contact",
  "Putties Fiberglass",
  "Bezbojni lak Premium",
  "Bazna boja Diamont",
  "Razređivač Standard",
  "Učvršćivač Brzi",
];

const COLOR_WORDS = [
  "White",
  "Black",
  "Grey",
  "Carmine Red",
  "Daffodil Yellow",
  "Zinc Yellow",
  "Light Ivory",
  "Signal Blue",
  "Leaf Green",
  "Copper",
  "Chrome",
  "Celadon",
  "Charcoal",
  "Beige",
];

const VOLUMES = ["400 ml", "500 ml", "600 ml", "1 l", "3,5 l", "5 l", "1 kg"];
const CATEGORIES = ["boje", "sprejevi", "zastita", "priprema", "oprema"];
const LINES = ["Automotive", "Industrial", "Refinish", "Workshop"];

/** Deterministički pseudo-slučajni generator (Lehmer / park-miller). */
function createRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * @param {number} [target] najmanji broj zapisa (podrazumevano 3500)
 * @returns {import("./engine.mjs").SearchRecord[]}
 */
export function createSearchFixture(target = 3500) {
  const random = createRandom(20250816);
  /** @type {import("./engine.mjs").SearchRecord[]} */
  const records = [];
  let familyCounter = 0;

  while (records.length < target) {
    const [brandSlug, brandName] = BRANDS[familyCounter % BRANDS.length];
    const familyWord = FAMILY_WORDS[familyCounter % FAMILY_WORDS.length];
    const line = LINES[familyCounter % LINES.length];
    const familyName = `${brandName} ${familyWord} ${line}`;
    const familySlug = `${slugify(familyName)}-${familyCounter}`;
    const category = CATEGORIES[familyCounter % CATEGORIES.length];

    records.push({
      id: `family:${familySlug}`,
      kind: "family",
      href: `/proizvodi/grupa/${familySlug}`,
      name: familyName,
      familySlug,
      brandSlug,
      brandName,
      categorySlugs: [category],
      technicalLine: line,
      imageSrc: `/products/${brandSlug}/${slugify(familyWord)}/${familySlug}.webp`,
      terms: [slugify(line), `${brandSlug}-${familyCounter}`],
    });

    // 12–44 varijante po porodici: baš raspon u kome nazivi postaju skoro isti.
    const variantCount = 12 + Math.floor(random() * 33);
    for (let position = 0; position < variantCount; position += 1) {
      const color = COLOR_WORDS[(position + familyCounter) % COLOR_WORDS.length];
      const volume = VOLUMES[(position + familyCounter * 3) % VOLUMES.length];
      const code = `${100 + ((position * 7 + familyCounter * 13) % 880)}`;
      const variantName = `${color} ${volume}`;
      const slug = `${familySlug}-${slugify(variantName)}-${code}`;

      records.push({
        id: slug,
        kind: "variant",
        href: `/proizvodi/${slug}`,
        name: `${familyName} ${variantName}`,
        familySlug,
        familyName,
        variantName,
        productCode: code,
        brandSlug,
        brandName,
        categorySlugs: [category],
        technicalLine: volume,
        quantityLabel: volume,
        imageSrc: `/products/${brandSlug}/${slugify(familyWord)}/${slug}.webp`,
        terms: [`cl${code}`, slugify(color), `${slugify(familyWord)}-${code}`],
        /*
         * `card` je najveći deo zapisa varijante u stvarnom assetu (accent,
         * klase i pun alt tekst), pa fixture bez njega ne bi merio isti oblik
         * podataka — a mera veličine je upravo ono zbog čega postoji.
         */
        card: {
          accent: `#${((familyCounter * 37 + position * 11) % 0xffffff)
            .toString(16)
            .padStart(6, "0")
            .toUpperCase()}`,
          sizeClass: ["S", "M", "L"][position % 3],
          volumeStatus: position % 5 === 0 ? "declared" : "verified",
          imageAlt: `${familyName} ${variantName}, zvanična ${brandName} ambalaža`,
          finish: position % 4 === 0 ? "sjaj" : undefined,
        },
      });
    }

    familyCounter += 1;
  }

  /*
   * Samostalni proizvodi sa oznakama tipa `C 2E50`: to su zapisi koje korisnik
   * traži po tačnoj šifri, i baš oni ne smeju da izgube od fuzzy pogotka po
   * nazivu neke od hiljadu varijanti.
   */
  const standaloneCodes = ["C 2E50", "R 2A10", "P 2E23", "H 2A14", "A 2220"];
  standaloneCodes.forEach((code, position) => {
    const name = `${code} ${["Clear coat", "AirtopTHINN", "Primer filler", "TopCURE", "ONYX ACTIVATOR"][position]}`;
    const slug = slugify(name);
    records.push({
      id: slug,
      kind: "standalone",
      href: `/proizvodi/${slug}`,
      name,
      productCode: code,
      brandSlug: "rm",
      brandName: "R-M",
      categorySlugs: ["boje"],
      technicalLine: "1 l",
      quantityLabel: "1 l",
      imageSrc: `/images/brands/rm/products/${slug}.webp`,
      terms: [slugify(code), "refinish"],
    });
  });

  /*
   * Udeo samostalnih proizvoda prati stvarni katalog (117 od 873 ≈ 13%).
   * Bez njih bi fixture bio skoro same varijante, a varijanta je NAJVEĆI zapis
   * (nosi `card`) — merenje veličine bi ispalo pesimističnije nego što jeste, a
   * rangiranje se nikad ne bi sudaralo sa samostalnim proizvodima.
   */
  const standaloneTarget = Math.round(records.length * 0.13);
  for (let position = records.length; standaloneCount(records) < standaloneTarget; position += 1) {
    const [brandSlug, brandName] = BRANDS[position % BRANDS.length];
    const word = FAMILY_WORDS[position % FAMILY_WORDS.length];
    const line = LINES[(position + 1) % LINES.length];
    const code = `${["A", "C", "P", "R", "H"][position % 5]} ${2000 + (position % 900)}`;
    const name = `${brandName} ${word} ${line} ${code}`;
    const slug = `${slugify(name)}-${position}`;

    records.push({
      id: slug,
      kind: "standalone",
      href: `/proizvodi/${slug}`,
      name,
      productCode: code,
      brandSlug,
      brandName,
      categorySlugs: [CATEGORIES[position % CATEGORIES.length]],
      technicalLine: VOLUMES[position % VOLUMES.length],
      quantityLabel: VOLUMES[position % VOLUMES.length],
      imageSrc: `/products/${brandSlug}/${slugify(word)}/${slug}.webp`,
      terms: [slugify(line), slugify(code)],
    });
  }

  return records;
}

function standaloneCount(records) {
  let total = 0;
  for (const record of records) if (record.kind === "standalone") total += 1;
  return total;
}

/**
 * Fixture upakovan u ISTU shemu koju servira `/katalog/search-index.json`.
 *
 * Postoji da bi merenje veličine asseta prolazilo kroz isti oblik payload-a i
 * istu `schemaVersion`, umesto da se veličina procenjuje množenjem trenutnog
 * asseta — procena je bila 110 KB gzip, a stvarno merenje je jedini način da se
 * ta tvrdnja proveri.
 *
 * @param {number} [target]
 */
export function createSearchIndexPayloadFixture(target = 3500) {
  const records = createSearchFixture(target);
  const counts = { family: 0, standalone: 0, variant: 0, total: records.length };
  for (const record of records) counts[record.kind] += 1;

  return { schemaVersion: 1, counts, records };
}
