import AjvModule from "ajv/dist/2020.js";

/**
 * Schema validacija mrežnog ulaza — Ajv, draft 2020-12.
 *
 * Zamenjuje ručno pisan interpreter iz P1. Taj interpreter nije bio pogrešan;
 * bio je dovoljan dok je jedini pozivalac bio test. Od trenutka kada isti kod
 * gleda telo koje stiže sa mreže, održavanje sopstvene implementacije
 * standarda postaje odgovornost koju ne želimo — svaki propušten rub je rupa
 * u proveri, a rubova u JSON Schema ima više nego što ijedan projekat treba
 * sam da pokriva.
 *
 * `ajv/dist/2020` je izabran jer ugovor izričito nosi
 * `$schema: draft/2020-12`. Klasa validatora mora odgovarati draftu koji šema
 * deklariše; `new Ajv()` iz korena paketa pokriva draft-07 i tiho bi tumačio
 * ugovor po drugim pravilima.
 *
 * Zavisnost je DIREKTNA i sa tačnom verzijom (`package.json`, `ajv: 8.20.0`).
 * `ajv@6` postoji u `node_modules` kao tranzitivna zavisnost ESLint-a; oslanjanje
 * na tuđe stablo znači da prijem faktura pukne kada ESLint promeni svoje.
 */

const Ajv = AjvModule.default ?? AjvModule;

export class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchemaError";
  }
}

/**
 * Opcije nisu podrazumevane — svaka je odluka.
 *
 * `strict: true`
 *   Nepoznat ili zanemaren keyword obara KOMPILACIJU šeme, ne validaciju
 *   podatka. Bez toga bi `minLenght` (tipfeler) bio tiho ignorisan i
 *   ograničenje bi postojalo samo u fajlu. Isto pravilo koje je nosio raniji
 *   interpreter, sada sprovedeno bibliotekom.
 *
 * `coerceTypes: false`
 *   `"1"` ne sme postati `1`. Iznosi su decimalni tekst upravo zato što broj
 *   nosi float; tiho pretvaranje bi poništilo ceo P1.
 *
 * `useDefaults: false`
 *   Validator ne sme da dopiše polje koje pošiljalac nije poslao. Dopisana
 *   vrednost bi ušla u semantic hash kao da je stigla.
 *
 * `removeAdditional: false`
 *   Nepoznato polje se ODBIJA, ne briše. Brisanje bi značilo da pošiljalac
 *   misli da je nešto poslao, a server to nikad nije video.
 *
 * `allErrors: false`
 *   Staje na prvoj grešci. Manje posla po zlonamernom telu, i poruka ostaje
 *   kratka — a duga lista grešaka nad telom koje stiže sa mreže je i sama
 *   kanal za curenje sadržaja.
 *
 * `validateFormats: true`
 *   Ako se `format` ikada upotrebi, mora biti stvarno proveren. Nepoznat
 *   format pod `strict` obara kompilaciju.
 */
const OPCIJE = Object.freeze({
  strict: true,
  allErrors: false,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  validateFormats: true,
});

/**
 * Kompajlira POUZDANU lokalnu šemu.
 *
 * Prima isključivo šemu iz `contracts/` — nikada oblik koji je stigao od
 * klijenta. Ajv se zato pravi bez ijednog registrovanog udaljenog resursa i
 * bez `loadSchema`: `$ref` na tuđi URL nema odakle da se razreši, pa se ne
 * može ni pokušati.
 *
 * @param {object} schema
 * @returns {(data: unknown) => boolean}
 */
export function compileTrustedSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new SchemaError("Šema mora biti objekat.");
  }
  const ajv = new Ajv(OPCIJE);
  try {
    return ajv.compile(schema);
  } catch (error) {
    /*
     * Neuspela kompilacija je greška u NAŠOJ šemi, ne u tuđem podatku.
     *
     * Poruka se prenosi jer opisuje fajl u repou i pomaže da se ispravi; ne
     * može da sadrži ništa iz zahteva, pošto zahteva u ovom trenutku nema.
     */
    throw new SchemaError(
      `Ugovor se ne kompajlira pod strict pravilima: ${(error && error.message) || "nepoznat razlog"}`,
    );
  }
}

/**
 * Sažeta greška: putanja i keyword, BEZ ijedne vrednosti iz tela.
 *
 * Ajv u `error.data`, `error.params` i verbose izlazu ume da nosi delove
 * validiranog dokumenta. To je ovde poslovna prepiska — naziv kupca, iznos,
 * šifra — pa se u poruku prenose samo `instancePath` i naziv pravila.
 *
 * Jedini izuzetak je `additionalProperty`: naziv NEPOZNATOG ključa je ono što
 * je pošiljalac izmislio, ne podatak o kupcu, i bez njega se greška ne može
 * ispraviti. Skraćuje se i čisti od svega osim bezopasnih znakova.
 */
function sazmi(error) {
  const putanja = typeof error?.instancePath === "string" && error.instancePath !== ""
    ? error.instancePath
    : "$";
  const keyword = typeof error?.keyword === "string" ? error.keyword : "invalid";

  if (keyword === "additionalProperties") {
    const ime = String(error?.params?.additionalProperty ?? "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 40);
    return { path: putanja, reason: ime ? `nepoznato polje: ${ime}` : "nepoznato polje" };
  }

  return { path: putanja, reason: `pravilo „${keyword}“ nije zadovoljeno` };
}

/**
 * Validira podatak prema već kompajliranoj šemi.
 *
 * @param {unknown} value
 * @param {(data: unknown) => boolean} validator
 * @returns {{ ok: boolean, errors: { path: string, reason: string }[] }}
 */
export function validateWithCompiled(value, validator) {
  const ok = validator(value);
  if (ok) return { ok: true, errors: [] };
  const errors = (validator.errors ?? []).map(sazmi);
  return { ok: false, errors: errors.length > 0 ? errors : [{ path: "$", reason: "nije po ugovoru" }] };
}
