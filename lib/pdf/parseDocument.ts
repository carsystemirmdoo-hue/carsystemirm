import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import {
  detectDocumentKind,
  looksLikePdf,
  MAX_LINES,
  MAX_PAGES,
  MAX_QUANTITY_DECIMALS,
  hasTableContinuation,
  isLineRow,
  parseHeader,
  parseLine,
  PARSER_VERSION,
  toRows,
  validateTotals,
} from "@/lib/pdf/biznisoftLayout.mjs";

/**
 * Čitanje BizniSoft PDF-a — ZAJEDNIČKI modul, bez serverske granice.
 *
 * Namerno BEZ `import "server-only"`. Isti kod treba da radi i na
 * kancelarijskom računaru, gde PDF ostaje lokalno; serversku granicu drži
 * `lib/pdf/extract.ts`, koji ovo samo re-eksportuje. Dve implementacije
 * geometrije bi značile dva parsera koji se tiho raziđu, pa ih nema.
 *
 * Modul ne uvozi Next, auth, bazu ni `server-only` — jedine zavisnosti su
 * `node:crypto`, `unpdf` i čista logika iz `biznisoftLayout.mjs`.
 *
 * `unpdf` radi POTPUNO lokalno — bez mrežnog poziva,
 * bez cloud OCR-a. Uzet je zato što vraća sve tekstualne elemente sa
 * transformacijom (X/Y), a raspored kolona ovog dokumenta se bez koordinata ne
 * može pouzdano pročitati: brojevi u susednim kolonama se u toku teksta slepe.
 *
 * OCR NIJE ugrađen: svih 11 stvarnih uzoraka ima ugrađen tekst. Dodavanje OCR-a
 * „za svaki slučaj" značilo bi granu koju nijedan dokument ne izvršava.
 */

export type ExtractedField<T> = { raw: string | null; value: T | null; status: string };

export type ParsedLine = ReturnType<typeof parseLine> & { lineNumber: number; raw: string };

export type ParsedDocument = {
  fileHash: string;
  pageCount: number;
  parserVersion: string;
  documentKind: string;
  /** `valid` | `totals_mismatch` | `unparsable` | `unsupported_requires_sample` */
  validationStatus: string;
  validationDetail: string | null;
  header: ReturnType<typeof parseHeader>;
  lines: ParsedLine[];
  totals: ReturnType<typeof validateTotals>;
};

/** SHA-256 sadržaja — jedini pouzdan identitet fajla. */
export function fileHashOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Čita PDF u strane sa pozicioniranim elementima.
 *
 * Radi nad KOPIJOM bajtova. pdf.js prenosi (`transfer`) prosleđeni buffer u
 * svoj worker i time ga odvaja, pa bi pozivaočev niz posle prvog poziva bio
 * prazan. Bez kopije drugi `parseBiznisoftPdf` nad istim nizom puca sa
 * „Unable to deserialize cloned data" — a upravo to radi provera duplikata,
 * koja isti fajl parsira dvaput.
 */
async function readPages(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  /*
   * Broj strana se proverava PRE nego što se ijedna pročita.
   *
   * Provera posle čitanja ne bi ništa štitila — trošak je upravo u čitanju.
   */
  if (pdf.numPages > MAX_PAGES) {
    return { pageCount: pdf.numPages, pages: [], tooManyPages: true as const };
  }
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const content = await (await pdf.getPage(n)).getTextContent();
    /*
     * `getTextContent()` vraća uniju `TextItem | TextMarkedContent`; drugi
     * oblik nema ni tekst ni transformaciju. Sužava se ovde, jednom, umesto
     * kastovanja na svakom mestu upotrebe.
     */
    const positioned: { str: string; x: number; y: number }[] = [];
    for (const raw of content.items) {
      const candidate = raw as { str?: unknown; transform?: unknown };
      if (typeof candidate.str !== "string") continue;
      if (!Array.isArray(candidate.transform)) continue;
      const transform = candidate.transform as number[];
      positioned.push({ str: candidate.str, x: transform[4], y: transform[5] });
    }
    const items = positioned;
    pages.push({ items, rows: toRows(items), text: items.map((i) => i.str).join(" ") });
  }
  return { pageCount: pdf.numPages, pages, tooManyPages: false as const };
}

/**
 * Parsira jedan dokument.
 *
 * Redosled provera je namerno od najgrublje ka najfinijoj: dokument koji nije
 * BizniSoft ne treba ni pokušavati da se čita po kolonama, a dokument čiji se
 * zbir ne slaže ne sme da stigne do faktura ni sa savršenim redovima.
 */
export async function parseBiznisoftPdf(bytes: Uint8Array): Promise<ParsedDocument> {
  const fileHash = fileHashOf(bytes);

  const emptyBase = {
    fileHash,
    pageCount: 0,
    parserVersion: PARSER_VERSION,
    header: parseHeader(""),
    lines: [] as ParsedLine[],
    totals: validateTotals([], null),
  };

  /*
   * Zaglavlje fajla se proverava pre nego što ijedan čitač vidi bajtove.
   *
   * Jeftino je, i sprečava da se tuđi format uopšte otvara.
   */
  if (!looksLikePdf(bytes)) {
    return {
      ...emptyBase,
      documentKind: "nepoznato",
      validationStatus: "unparsable",
      validationDetail: "Fajl ne počinje kao PDF.",
    };
  }

  /*
   * Neuspelo čitanje je ISHOD, ne izuzetak.
   *
   * Šifrovan, skraćen ili oštećen PDF baca iz čitača. Ako to izađe iz ove
   * funkcije, jedan loš fajl obori ceo grupni uvoz i devetnaest uspešnih
   * dokumenata nestane iz izveštaja zajedno sa dvadesetim.
   *
   * Poruka čitača se NE prenosi dalje: ume da sadrži deo teksta dokumenta, a
   * to je poslovna prepiska sa imenom i adresom kupca.
   */
  let read: Awaited<ReturnType<typeof readPages>>;
  try {
    read = await readPages(bytes);
  } catch {
    return {
      ...emptyBase,
      documentKind: "nepoznato",
      validationStatus: "unparsable",
      validationDetail: "Dokument se ne može pročitati (oštećen, skraćen ili zaštićen lozinkom).",
    };
  }
  const { pageCount, pages, tooManyPages } = read;
  const fullText = pages.map((p) => p.text).join("\n");
  const header = parseHeader(fullText);

  const base = {
    fileHash,
    pageCount,
    parserVersion: PARSER_VERSION,
    header,
    lines: [] as ParsedLine[],
    totals: validateTotals([], null),
  };

  if (tooManyPages) {
    return {
      ...base,
      documentKind: "nepoznato",
      validationStatus: "unsupported_requires_sample",
      validationDetail: `Dokument ima više od ${MAX_PAGES} strana. Za taj obim ne postoji potvrđen uzorak.`,
    };
  }

  if (!header.isBiznisoft) {
    return {
      ...base,
      documentKind: "nepoznato",
      validationStatus: "unparsable",
      validationDetail: "Dokument ne nosi BizniSoft oznaku.",
    };
  }

  const kind = detectDocumentKind(fullText);
  if (!kind.supported) {
    /*
     * Nepoznat naslov NIJE greška — to je dokument čiji oblik nema stvaran
     * uzorak. Nagađanje tipa je jedini način da storno tiho uđe u promet kao
     * prodaja, pa se ovde staje.
     */
    return {
      ...base,
      documentKind: kind.kind,
      validationStatus: "unsupported_requires_sample",
      validationDetail:
        "Tip dokumenta nije prepoznat iz naslova. Za ovaj oblik ne postoji stvaran uzorak.",
    };
  }

  if (hasTableContinuation(pages)) {
    return {
      ...base,
      documentKind: kind.kind,
      validationStatus: "unsupported_requires_sample",
      validationDetail:
        "Tabela se nastavlja na sledećoj strani. Nijedan stvaran uzorak ne dokazuje taj oblik.",
    };
  }

  const lines: ParsedLine[] = [];
  for (const page of pages) {
    for (const row of page.rows) {
      if (!isLineRow(row)) continue;
      lines.push({ ...parseLine(row.cells), lineNumber: lines.length + 1, raw: row.raw });
    }
  }

  if (lines.length > MAX_LINES) {
    return {
      ...base,
      documentKind: kind.kind,
      validationStatus: "unsupported_requires_sample",
      validationDetail: `Dokument ima više od ${MAX_LINES} stavki. Za taj obim ne postoji potvrđen uzorak.`,
    };
  }

  /*
   * Količina preciznija nego što baza može da sačuva.
   *
   * `invoice_lines.quantity` je `numeric(14,3)`; četvrtu decimalu bi Postgres
   * tiho zaokružio, pa bi u bazi stajala količina koja ne piše na dokumentu.
   * Tiho odstupanje u količini je gore od odbijenog dokumenta — vidi se tek
   * kada se ne poklopi sa magacinom.
   */
  const preciznije = lines.filter((l) => l.quantityDecimals > MAX_QUANTITY_DECIMALS);
  if (preciznije.length > 0) {
    return {
      ...base,
      lines,
      documentKind: kind.kind,
      validationStatus: "unsupported_requires_sample",
      validationDetail:
        `Količina je zapisana na više od ${MAX_QUANTITY_DECIMALS} decimale. ` +
        "Za taj oblik ne postoji potvrđen uzorak.",
    };
  }

  if (lines.length === 0) {
    return {
      ...base,
      documentKind: kind.kind,
      validationStatus: "unparsable",
      validationDetail: "Nijedna stavka nije pročitana.",
    };
  }

  const broken = lines.filter((l) => l.status !== "ok");
  const totals = validateTotals(lines, header.printedGrossTotal.value);

  if (broken.length > 0) {
    return {
      ...base,
      lines,
      totals,
      documentKind: kind.kind,
      validationStatus: "totals_mismatch",
      validationDetail: `${broken.length} stavki ne prolazi proveru aritmetike.`,
    };
  }

  if (!totals.ok) {
    return {
      ...base,
      lines,
      totals,
      documentKind: kind.kind,
      validationStatus: "totals_mismatch",
      // Bez iznosa u poruci: detalj se čita sa ekrana, ne iz loga.
      validationDetail: "Odštampan zbir se ne poklapa sa izračunatim.",
    };
  }

  const missingHeader = (["documentNumber", "partnerCode", "documentDate"] as const)
    .filter((k) => header[k].status !== "ok");
  if (missingHeader.length > 0) {
    return {
      ...base,
      lines,
      totals,
      documentKind: kind.kind,
      validationStatus: "unparsable",
      validationDetail: `Nedostaju polja zaglavlja: ${missingHeader.join(", ")}.`,
    };
  }

  return {
    ...base,
    lines,
    totals,
    documentKind: kind.kind,
    validationStatus: "valid",
    validationDetail: null,
  };
}
