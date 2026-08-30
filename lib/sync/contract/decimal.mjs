/**
 * Decimalni brojevi kao TEKST, od početka do kraja.
 *
 * Nigde u ovom modulu nema `Number`, `parseFloat` ni aritmetike nad float-om.
 * To nije opreznost nego jedina ispravna opcija: `0.1 + 0.2` je `0.30000000000000004`,
 * pa bi `String(Number("0.30"))` vratio drugačiji tekst od onog koji je stigao.
 * Vrednost koja prođe kroz binarni float više nije ista vrednost, a povratak u
 * tekst ne vraća izgubljeno.
 *
 * Ovde se decimale samo PROVERAVAJU i DOPUNJAVAJU nulama do fiksne skale.
 * Nikada se ne skraćuju: više decimala nego što skala dozvoljava je odbijanje,
 * ne zaokruživanje. Tiho zaokružena količina se vidi tek kada se ne poklopi sa
 * magacinom.
 */

/** Strogi oblik: opcioni minus, cifre, opciono tačka i cifre. Bez eksponenta. */
const DECIMALNI = /^(-?)(\d+)(?:\.(\d+))?$/;

export class DecimalError extends Error {
  constructor(message) {
    super(message);
    this.name = "DecimalError";
  }
}

/**
 * Skale po polju — tačno onoliko koliko odgovarajuća kolona može da sačuva.
 *
 * Brojevi NISU preuzeti iz dokumentacije nego iz `db/schema/sales.ts`:
 * `quantity numeric(14,3)`, `unit_price numeric(14,4)`,
 * `discount_percent numeric(6,3)`, `tax_percent numeric(6,3)`,
 * `line_amount numeric(14,2)`. Količina ima TRI decimale, ne dve.
 *
 * `intDigits` je gornja granica celobrojnog dela, izvedena iz iste precizije
 * (npr. `numeric(14,3)` → 11 cifara ispred tačke). Vrednost izvan toga
 * Postgres odbija; bolje da bude odbijena pre nego što transakcija krene.
 */
export const SKALE = {
  quantity: { scale: 3, intDigits: 11 },
  unit_price: { scale: 4, intDigits: 10 },
  discount_percent: { scale: 3, intDigits: 3 },
  tax_percent: { scale: 3, intDigits: 3 },
  tax_amount: { scale: 2, intDigits: 12 },
  gross_amount: { scale: 2, intDigits: 12 },
  printed_gross_total: { scale: 2, intDigits: 12 },
};

/**
 * Normalizuje decimalni tekst na canonical oblik za zadatu skalu.
 *
 * Pravila, sva bez izuzetka:
 * - ulaz mora biti string u obliku `-?cifre[.cifre]`; sve drugo je greška
 *   (zarez, razmak, `%`, eksponent, `+`, prazan string);
 * - VIŠE decimala od skale je GREŠKA, nikad zaokruživanje;
 * - manje decimala se dopunjuje nulama do skale, pa `1`, `1.0` i `1.000` daju
 *   isti canonical oblik — to je ono što čini hash stabilnim;
 * - vodeće nule celobrojnog dela se uklanjaju (`007` → `7`), jer je to ISTA
 *   brojna vrednost; šifre i brojevi dokumenata NISU brojevi i ne prolaze kroz
 *   ovu funkciju;
 * - `-0` postaje `0`: minus nule nema kao poslovnu vrednost, a nosio bi dva
 *   različita hash-a za istu stvar.
 *
 * @param {unknown} raw
 * @param {keyof typeof SKALE} polje
 * @returns {string}
 */
export function canonicalDecimal(raw, polje) {
  const pravilo = SKALE[polje];
  if (!pravilo) throw new DecimalError(`Nepoznato decimalno polje „${polje}“.`);

  if (typeof raw !== "string") {
    throw new DecimalError(`Polje „${polje}“ mora biti decimalni tekst, ne broj.`);
  }
  const m = DECIMALNI.exec(raw);
  if (!m) throw new DecimalError(`Polje „${polje}“ nije decimalni tekst sa tačkom.`);

  const [, znak, ceo, decimale = ""] = m;

  if (decimale.length > pravilo.scale) {
    throw new DecimalError(
      `Polje „${polje}“ ima ${decimale.length} decimala, a najviše ${pravilo.scale} se može sačuvati. ` +
        "Zaokruživanje bi promenilo vrednost bez traga.",
    );
  }

  const ceoBezNula = ceo.replace(/^0+(?=\d)/, "");
  if (ceoBezNula.length > pravilo.intDigits) {
    throw new DecimalError(
      `Polje „${polje}“ ima ${ceoBezNula.length} cifara ispred tačke, a najviše ${pravilo.intDigits} staje.`,
    );
  }

  const dopunjene = decimale.padEnd(pravilo.scale, "0");
  const telo = pravilo.scale > 0 ? `${ceoBezNula}.${dopunjene}` : ceoBezNula;

  // `-0.000` i `0.000` su ista poslovna vrednost.
  const jeNula = /^0(\.0*)?$/.test(telo);
  return jeNula ? telo : `${znak}${telo}`;
}

/**
 * Srpski odštampan zapis → decimalni tekst sa tačkom, BEZ prolaska kroz broj.
 *
 * Ulaz je ono što stvarno piše na dokumentu (`"1.234,500"`, `"20%"`). Tačka je
 * separator hiljada, zarez decimalni. Pretvaranje je čisto tekstualno; da je
 * išlo kroz `Number`, `"1234,5678901234567"` bi se vratio kao drugi broj.
 *
 * Vraća `null` kada ulaza nema, da bi pozivalac razlikovao „nije odštampano“
 * od „nula“ — nula bi tiho postala legitimna cena.
 *
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function decimalFromPrinted(raw) {
  if (typeof raw !== "string") return null;
  const ocisceno = raw.trim().replace(/%$/, "").replace(/\s/g, "");
  if (ocisceno === "") return null;

  // Isti prihvaćeni oblik kao `parseSerbianNumber` u čitaču dokumenta.
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(ocisceno)) return null;

  const bezHiljada = ocisceno.replace(/\./g, "");
  const saTackom = bezHiljada.replace(",", ".");
  return DECIMALNI.test(saTackom) ? saTackom : null;
}

/**
 * Decimalni tekst → `number`, ISKLJUČIVO za aritmetičku proveru.
 *
 * Postoji zato što je postojeća provera iznosa (`checkLineArithmetic`,
 * `validateTotals`) float-based, i mora ostati ista formula sa istom
 * tolerancijom. Rezultat se NIKADA ne vraća u tekst i ne upisuje — za upis
 * uvek ide canonical string.
 *
 * @param {string} value
 * @returns {number}
 */
export function toNumberForCheck(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new DecimalError("Decimalni tekst se ne može proveriti kao broj.");
  return n;
}
