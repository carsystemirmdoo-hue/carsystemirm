/**
 * BizniSoft PDF: raspored, gramatika reda i provere — čista logika, bez I/O.
 *
 * Sve u ovom modulu je IZVEDENO iz stvarnih uzoraka i proverljivo nad njima;
 * ništa nije pretpostavljeno. Vidi `docs/b2b/16-biznisoft-pdf-evidence-audit.md`.
 *
 * Odvojeno od ekstrakcije da bi se gramatika mogla dokazati bez ijednog PDF-a —
 * i da bi test mogao da opiše ulaz koji se u stvarnom dokumentu retko sretne.
 */

/**
 * Verzija parsera.
 *
 * Upisuje se uz svaki dokument. Bez nje se posle izmene pravila ne može
 * odgovoriti koji su dokumenti pročitani starim parserom — a to je prvo
 * pitanje kad se pojavi greška.
 */
/**
 * Gornje granice jednog dokumenta.
 *
 * Nisu procena „koliko je razumno", nego zaštita od posla koji niko nije
 * naručio: PDF od tri megabajta može nositi deset hiljada strana, a čitanje
 * raste brže od linearnog. Bez granice jedan fajl zauzme server na minute.
 *
 * Brojevi su daleko iznad svega što stvarni uzorci pokazuju (najviše 2 strane
 * i 13 stavki), pa granica ne može zaustaviti stvaran dokument a da to ne bude
 * vest sama po sebi. Prekoračenje NIJE greška fajla — to je oblik koji nemamo
 * potvrđen, pa ide u `unsupported_requires_sample`.
 */
export const MAX_PAGES = 40;
export const MAX_LINES = 500;

/**
 * Koliko decimala količine baza može da sačuva.
 *
 * `invoice_lines.quantity` je `numeric(14,3)`. Četvrta decimala se ne odbija —
 * Postgres je tiho zaokruži, pa bi u bazi stajala količina koja ne piše na
 * dokumentu, a nigde se ne bi videlo da je promenjena.
 */
export const MAX_QUANTITY_DECIMALS = 3;

/**
 * Broj decimala u zapisu broja, kako je otštampan.
 *
 * Radi nad SIROVIM tekstom, ne nad pročitanim brojem: `parseSerbianNumber`
 * vraća `number`, a on više ne pamti koliko je decimala pisalo.
 *
 * @param {string | null | undefined} raw
 * @returns {number}
 */
export function decimalsOf(raw) {
  if (typeof raw !== "string") return 0;
  const match = raw.trim().match(/,(\d+)\s*$/);
  return match ? match[1].length : 0;
}

/**
 * Da li bajtovi uopšte počinju kao PDF.
 *
 * Traži se `%PDF-` na SAMOM početku, iako čitači tolerišu smeće ispred. Fajl
 * sa tuđim zaglavljem pa PDF telom (polyglot) je uvek nečiji trik, nikad
 * BizniSoft izvoz, i nema razloga da ga primamo.
 *
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function looksLikePdf(bytes) {
  if (!bytes || bytes.length < 5) return false;
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return magic.every((byte, i) => bytes[i] === byte);
}

export const PARSER_VERSION = "biznisoft-pdf-1";

/**
 * Presavijanje dijakritika.
 *
 * Oznake u PDF-u se pri ekstrakciji umeju izgubiti ili razložiti, pa se
 * poređenje radi nad presavijenim oblikom. „Šifra" i „Sifra" moraju voditi na
 * isti ključ; suprotno bi značilo da dokument prolazi ili pada zavisno od toga
 * kako je font kodiran.
 *
 * @param {string} value
 */
export function foldDiacritics(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .replace(/Đ/g, "Dj")
    .toLowerCase();
}

/**
 * Kolone tabele stavki, po X koordinati.
 *
 * Granice su izmerene nad stvarnim uzorcima. Namerno su intervali, ne tačke:
 * desno poravnati brojevi počinju na različitom X-u zavisno od broja cifara.
 */
export const COLUMNS = [
  { key: "rb", from: 25, to: 45 },
  { key: "articleCode", from: 45, to: 80 },
  { key: "description", from: 80, to: 215 },
  { key: "barcode", from: 215, to: 265 },
  { key: "unit", from: 265, to: 300 },
  { key: "quantity", from: 300, to: 345 },
  { key: "unitPrice", from: 345, to: 400 },
  { key: "discountPercent", from: 400, to: 435 },
  { key: "taxPercent", from: 435, to: 470 },
  { key: "taxAmount", from: 470, to: 510 },
  { key: "grossAmount", from: 510, to: 565 },
];

/** Tolerancija po Y pri grupisanju elemenata u red. */
export const ROW_TOLERANCE = 1.5;

/**
 * Broj u srpskom zapisu: tačka za hiljade, zarez za decimale.
 *
 * Vraća `null` umesto `NaN` ili nule kada vrednost nije broj. Nula bi bila
 * najgori mogući ishod — tiho bi postala legitimna cena ili količina.
 *
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseSerbianNumber(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/%$/, "").replace(/\s/g, "");
  if (cleaned === "") return null;
  // Odbija sve što nije broj u očekivanom zapisu — bez „popravljanja" ulaza.
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Grupiše izdvojene elemente u redove po Y, pa u ćelije po X.
 *
 * @param {readonly {str: string, x: number, y: number}[]} items
 * @returns {{ y: number, cells: Record<string, string>, raw: string }[]}
 */
export function toRows(items) {
  const buckets = [];
  for (const item of items ?? []) {
    const text = String(item.str ?? "").trim();
    if (!text) continue;
    const found = buckets.find((b) => Math.abs(b.y - item.y) <= ROW_TOLERANCE);
    if (found) found.items.push(item);
    else buckets.push({ y: item.y, items: [item] });
  }

  return buckets
    .sort((a, b) => b.y - a.y)
    .map((bucket) => {
      const sorted = [...bucket.items].sort((a, b) => a.x - b.x);
      const cells = {};
      for (const item of sorted) {
        const column = COLUMNS.find((c) => item.x >= c.from && item.x < c.to);
        if (!column) continue;
        cells[column.key] = `${cells[column.key] ?? ""}${String(item.str).trim()}`;
      }
      return {
        y: bucket.y,
        cells,
        raw: sorted.map((i) => String(i.str).trim()).join(" "),
      };
    });
}

/** Zaokruživanje na paru — dokument tako i štampa. */
const round2 = (value) => Math.round(value * 100) / 100;

/** Red je stavka kada nosi redni broj oblika `N.` u prvoj koloni. */
export function isLineRow(row) {
  return /^\d+\.$/.test(row?.cells?.rb ?? "");
}

/**
 * Aritmetika reda, izvedena i proverena nad 53/53 stavke stvarnih uzoraka:
 *
 *     neto      = KOL × Cena_bez_PDV × (1 − Rabat/100)
 *     IznosPDV  = neto × PDV/100
 *     Vrednost  = neto × (1 + PDV/100)
 *
 * @param {Record<string, string>} cells
 */
/**
 * Aritmetika jedne stavke — JEDNA formula za oba ulaza.
 *
 * Izdvojena iz `parseLine` da bi canonical (JSON) put mogao da proveri iste
 * iznose istim izrazom i istom tolerancijom. Druga formula za istu proveru bi
 * značila da se dva ulaza mogu razići u tome šta prihvataju, a razlika bi se
 * videla tek kada se izveštaj ne poklopi sa knjigovodstvom.
 *
 * Poredi se sa ZAOKRUŽENOM očekivanom vrednošću. Dokument štampa iznose
 * zaokružene na paru; očekivana vrednost se računa iz količine i cene i nosi
 * pun decimalni rep. Poređenje nezaokruženog sa odštampanim lažno pada tačno na
 * granici zaokruživanja — a to je najčešći red, ne redak slučaj.
 *
 * Tolerancija ostaje apsolutna i mala (1 para). Relativna bi na velikim
 * iznosima progutala razliku koja se u zbiru vidi.
 *
 * @param {{ quantity: number, unitPrice: number, discountPercent: number,
 *           taxPercent: number, taxAmount: number | null, grossAmount: number }} line
 * @returns {{ netAmount: number, off: string[] }}
 */
export function checkLineArithmetic(line) {
  const netAmount = round2(
    line.quantity * line.unitPrice * (1 - line.discountPercent / 100),
  );
  const expectedTax = netAmount * (line.taxPercent / 100);
  const expectedGross = netAmount + round2(expectedTax);

  const off = [];
  if (line.taxAmount !== null && Math.abs(round2(expectedTax) - line.taxAmount) > 0.011) {
    off.push("taxAmount");
  }
  if (Math.abs(round2(expectedGross) - line.grossAmount) > 0.011) off.push("grossAmount");

  return { netAmount, off };
}

export function parseLine(cells) {
  /*
   * Šifra je PRVI token ćelije, ne cela ćelija.
   *
   * PDF ekstraktori spajaju bliske tekstualne blokove u jedan element, pa
   * ćelija šifre ume da povuče i početak naziva („900001 ARTIKAL"). Uzimanje
   * cele ćelije bi tada dalo šifru koja ne postoji ni u jednom katalogu, i
   * artikal bi zauvek ostao nemapiran bez vidljivog razloga.
   *
   * Ostatak se vraća nazivu, da se podatak ne izgubi.
   */
  const quantityDecimals = decimalsOf(cells.quantity);
  const rawCode = (cells.articleCode ?? "").trim();
  const [articleCode, ...codeTail] = rawCode.split(/\s+/);
  const spilledDescription = codeTail.join(" ");
  const quantity = parseSerbianNumber(cells.quantity);
  const unitPrice = parseSerbianNumber(cells.unitPrice);
  const discountPercent = parseSerbianNumber(cells.discountPercent) ?? 0;
  const taxPercent = parseSerbianNumber(cells.taxPercent);
  const taxAmount = parseSerbianNumber(cells.taxAmount);
  const grossAmount = parseSerbianNumber(cells.grossAmount);

  const missing = [];
  if (!articleCode) missing.push("articleCode");
  if (quantity === null) missing.push("quantity");
  if (unitPrice === null) missing.push("unitPrice");
  if (taxPercent === null) missing.push("taxPercent");
  if (grossAmount === null) missing.push("grossAmount");

  if (missing.length > 0) {
    return {
      status: `missing:${missing.join(",")}`,
      articleCode: articleCode || null,
      description: mergedDescription(cells, spilledDescription),
      unit: (cells.unit ?? "").trim() || null,
      quantity, quantityDecimals, unitPrice, discountPercent, taxPercent,
      taxAmount, grossAmount,
      netAmount: null,
      printed: printedCells(cells),
    };
  }

  const { netAmount, off } = checkLineArithmetic({
    quantity, unitPrice, discountPercent, taxPercent, taxAmount, grossAmount,
  });

  return {
    status: off.length === 0 ? "ok" : `arithmetic:${off.join(",")}`,
    articleCode,
    description: mergedDescription(cells, spilledDescription),
    unit: (cells.unit ?? "").trim() || null,
    quantity, quantityDecimals, unitPrice, discountPercent, taxPercent,
    taxAmount, grossAmount,
    netAmount,
    printed: printedCells(cells),
  };
}

/**
 * ODŠTAMPANI zapis brojčanih ćelija, tačno kako stoji na dokumentu.
 *
 * Postoji zato što `parseSerbianNumber` vraća `number`, a binarni float više ne
 * pamti šta je pisalo: `String(0.1 + 0.2)` je dokaz da povratak u tekst nije
 * povratak tačnosti. Canonical zapis mora nositi decimalu iz dokumenta, pa mu
 * treba izvor pre pretvaranja u broj.
 *
 * Ovo se NE koristi za aritmetiku i ne menja nijedan postojeći ishod — samo
 * čuva sirovi zapis polja koja se kasnije prenose kao decimalni tekst.
 *
 * @param {Record<string, string>} cells
 */
function printedCells(cells) {
  const uzmi = (key) => {
    const raw = (cells?.[key] ?? "").trim();
    return raw === "" ? null : raw;
  };
  return {
    quantity: uzmi("quantity"),
    unitPrice: uzmi("unitPrice"),
    discountPercent: uzmi("discountPercent"),
    taxPercent: uzmi("taxPercent"),
    taxAmount: uzmi("taxAmount"),
    grossAmount: uzmi("grossAmount"),
  };
}

/** Naziv iz svoje ćelije, uz ono što je prelilo iz ćelije šifre. */
function mergedDescription(cells, spilled) {
  const own = (cells.description ?? "").trim();
  const joined = [spilled, own].filter(Boolean).join(" ").trim();
  return joined || null;
}

/** Oznake iz kojih se čita tip dokumenta. Presavijeni oblik. */
const DOCUMENT_TITLES = [
  { match: "racun-otpremnica", kind: "faktura" },
  { match: "faktura", kind: "faktura" },
];

/**
 * Tip dokumenta — ISKLJUČIVO iz onoga što dokument sam kaže.
 *
 * Nema pravila koje bi pogađalo storno, povrat ili korekciju: nijedan takav
 * uzorak ne postoji, pa bi svako pravilo bilo izmišljen format. Nepoznat naslov
 * vodi u `unsupported_requires_sample`, gde ga vidi čovek.
 *
 * @param {string} text
 * @returns {{ kind: string, supported: boolean }}
 */
export function detectDocumentKind(text) {
  const folded = foldDiacritics(text ?? "");
  for (const entry of DOCUMENT_TITLES) {
    if (folded.includes(entry.match)) return { kind: entry.kind, supported: true };
  }
  return { kind: "nepoznato", supported: false };
}

/**
 * Da li se tabela nastavlja na sledećoj strani.
 *
 * U oba dvostrana uzorka sve stavke su na prvoj strani, a druga je ponovljeno
 * zaglavlje. Nastavak tabele NIJE dokazan nijednim dokumentom, pa se ne
 * pokušava spajanje — dokument ide u `unsupported_requires_sample`.
 *
 * @param {readonly {rows: object[]}[]} pages
 */
export function hasTableContinuation(pages) {
  return (pages ?? []).slice(1).some((page) => (page.rows ?? []).some(isLineRow));
}

/**
 * Provera zbira dokumenta.
 *
 * Dokument sa neusklađenim zbirom NIKAD tiho ne postaje validna faktura — to je
 * jedini oblik greške koji se ne primeti dok se ne uporedi sa knjigovodstvom.
 *
 * @param {readonly {netAmount: number|null, taxAmount: number|null}[]} lines
 * @param {number | null} printedGrossTotal
 */
export function validateTotals(lines, printedGrossTotal) {
  const usable = (lines ?? []).filter((l) => l.grossAmount !== null);
  /*
   * Sabiraju se ODŠTAMPANE vrednosti redova, ne preračunate.
   *
   * Dokument zaokružuje svaki red na paru pa ih sabira; preračunavanje iz
   * količine i cene daje nezaokruženu vrednost, i razlika raste sa brojem
   * stavki. Poređenje preračunatog zbira sa odštampanim ukupnim iznosom zato
   * lažno pada na dužim fakturama — a upravo su duže fakture one kod kojih
   * greška u čitanju najviše košta.
   *
   * Aritmetika svakog reda je već proverena u `parseLine`; ovde se proverava
   * da se odštampani redovi sabiraju u odštampani ukupan iznos.
   */
  const computed = usable.reduce((sum, l) => sum + l.grossAmount, 0);

  if (printedGrossTotal === null || printedGrossTotal === undefined) {
    return { ok: false, reason: "printed_total_missing", computed, printed: null };
  }
  /*
   * Tolerancija prati broj stavki: svaka stavka nosi svoje zaokruženje na
   * paru. Fiksna tolerancija bi na dokumentu sa 13 stavki lažno padala.
   */
  const tolerance = 0.011 * Math.max(1, usable.length) + 0.011;
  const ok = Math.abs(computed - printedGrossTotal) <= tolerance;
  return {
    ok,
    reason: ok ? null : "totals_mismatch",
    computed,
    printed: printedGrossTotal,
  };
}

/**
 * Polja zaglavlja.
 *
 * Svako polje vraća i SIROVI izdvojeni tekst i normalizovanu vrednost. Kad se
 * kasnije pojavi spor oko pročitane vrednosti, jedino pitanje koje vredi je
 * „šta je u dokumentu stvarno pisalo".
 *
 * @param {string} text  ceo tekst dokumenta
 */
export function parseHeader(text) {
  const src = String(text ?? "");
  const folded = foldDiacritics(src);

  const field = (raw, value, status) => ({ raw: raw ?? null, value: value ?? null, status });

  // Broj dokumenta: oblik `NN-RN#########`, dokazan nad svim uzorcima.
  const numMatch = src.match(/br\.\s*([0-9]+-RN[0-9]+)/i);

  /*
   * Šifra partnera se u ekstrakciji javlja i PRE i POSLE oznake, zavisno od
   * redosleda crtanja. Zato dva obrasca — a ne „popravljanje" jednog.
   * Vrednost ostaje TEKST: vodeća nula je deo šifre.
   */
  /*
   * `[^\S\n]*` umesto `\s*`: oznaka i vrednost moraju biti u ISTOM redu.
   * Sa `\s*` bi „Šifra partnera:" na kraju reda pokupilo prvu reč sledećeg
   * reda i tiho je proglasilo šifrom partnera.
   */
  const partnerAfter = src.match(/Šifra partnera:[^\S\n]*([0-9A-Za-z]+)/);
  const partnerBefore = src.match(/([0-9A-Za-z]+)[^\S\n]*Šifra partnera:/);
  const partnerFolded = folded.match(/sifra partnera:[^\S\n]*([0-9a-z]+)/);
  const partnerRaw =
    partnerAfter?.[1] ?? partnerBefore?.[1] ?? partnerFolded?.[1] ?? null;

  const dateMatch = src.match(/Datum izdavanja ra[čc]una:\s*(\d{2}\.\d{2}\.\d{4})/i);
  const totalMatch = src.match(/Ukupan iznos sa PDV:\s*([\d.,]+)/i);

  // PIB kupca je DRUGI PIB u dokumentu — prvi pripada izdavaocu.
  const pibs = [...src.matchAll(/PIB:\s*(\d{6,})/g)].map((m) => m[1]);

  return {
    documentNumber: field(numMatch?.[1], numMatch?.[1], numMatch ? "ok" : "missing"),
    partnerCode: field(partnerRaw, partnerRaw, partnerRaw ? "ok" : "missing"),
    documentDate: field(
      dateMatch?.[1],
      dateMatch ? isoFromSerbianDate(dateMatch[1]) : null,
      dateMatch ? "ok" : "missing",
    ),
    printedGrossTotal: field(
      totalMatch?.[1],
      totalMatch ? parseSerbianNumber(totalMatch[1]) : null,
      totalMatch ? "ok" : "missing",
    ),
    /** Pomoćni podatak za office review — NIKAD osnov automatskog spajanja. */
    customerPib: field(pibs[1], pibs[1], pibs.length > 1 ? "ok" : "missing"),
    issuerPib: field(pibs[0], pibs[0], pibs.length > 0 ? "ok" : "missing"),
    isBiznisoft: folded.includes("biznisoft.com"),
  };
}

/** `dd.mm.yyyy` → `yyyy-mm-dd`; `null` na svaki drugi oblik. */
export function isoFromSerbianDate(value) {
  const m = String(value ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo}-${d}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Odbija 31.02. i slično: Date bi ga tiho pomerio u mart.
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
