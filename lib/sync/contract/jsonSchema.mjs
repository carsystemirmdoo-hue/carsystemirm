/**
 * Namerno mali JSON Schema validator.
 *
 * Zašto sopstveni, a ne biblioteka
 * --------------------------------
 * Autoritativni ugovor je `contracts/invoice-ingest/v1/schema.json`. Da bi
 * ostao JEDINA definicija, mora ga neko čitati — a ne prepisivati u Zod, jer
 * dve definicije se raziđu tačno onda kada niko ne gleda.
 *
 * `ajv` u `node_modules` postoji, ali kao TRANZITIVNA zavisnost ESLint-a i u
 * verziji 6 (draft-07). Oslanjanje na tuđu tranzitivnu zavisnost znači da
 * validacija ugovora pukne kada ESLint promeni svoje stablo — a to nije razlog
 * zbog koga se sme pokvariti uvoz faktura. Nova zavisnost za ovoliko keyword-a
 * ne zavređuje mesto u `package.json`.
 *
 * Zašto je ovo bezbedno
 * ---------------------
 * Validator podržava TAČNO onaj skup keyword-a koji ugovor koristi i **baca na
 * svaki koji ne poznaje** — i u šemi i u podšemi. Bez toga bi neko dodao
 * `oneOf` ili `format` u šemu, validator bi ga tiho ignorisao, i ograničenje
 * bi postojalo samo u fajlu. Tako se nepodržan keyword vidi odmah, kao
 * greška u testu, a ne kao rupa u produkciji.
 *
 * Bez `$ref`, bez rekurzivnih šema, bez remote učitavanja.
 */

/** Keyword-i koje ovaj validator zaista sprovodi. */
const PODRZANI = new Set([
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
]);

/** Keyword-i koji su čista dokumentacija i ne nose ograničenje. */
const ANOTACIJE = new Set(["$schema", "$id", "title", "description", "examples", "default"]);

export class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchemaError";
  }
}

/**
 * Greška validacije: putanja + razlog, bez ijednog dela vrednosti.
 *
 * Vrednost se NE ubacuje u poruku. Poruka ide u log i na ekran, a polje koje
 * ne prolazi proveru ume da bude naziv kupca ili iznos — dakle upravo ono što
 * ne sme da procuri kroz grešku.
 */
function greska(putanja, razlog) {
  return { path: putanja || "$", reason: razlog };
}

/**
 * Validira `value` prema `schema`.
 *
 * @param {unknown} value
 * @param {object} schema
 * @returns {{ ok: boolean, errors: { path: string, reason: string }[] }}
 */
export function validateAgainstSchema(value, schema) {
  const errors = [];
  hodaj(value, schema, "$", errors);
  return { ok: errors.length === 0, errors };
}

function proveriKeywords(schema, putanja) {
  for (const key of Object.keys(schema)) {
    if (ANOTACIJE.has(key) || PODRZANI.has(key)) continue;
    throw new SchemaError(
      `Šema na „${putanja}“ koristi keyword „${key}“ koji ovaj validator ne sprovodi. ` +
        "Dodaj podršku ili ukloni keyword — tiho ignorisanje bi značilo ograničenje koje postoji samo u fajlu.",
    );
  }
}

function hodaj(value, schema, putanja, errors) {
  proveriKeywords(schema, putanja);

  if (schema.type !== undefined && !tipOdgovara(value, schema.type)) {
    errors.push(greska(putanja, `očekivan tip ${[].concat(schema.type).join(" ili ")}`));
    return;
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(greska(putanja, "vrednost nije u dozvoljenom skupu"));
    return;
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(greska(putanja, "vrednost nije jednaka zahtevanoj"));
    return;
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(greska(putanja, `kraće od ${schema.minLength} znakova`));
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(greska(putanja, `duže od ${schema.maxLength} znakova`));
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push(greska(putanja, "oblik ne odgovara zahtevanom"));
    }
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(greska(putanja, `manje od ${schema.minimum}`));
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(greska(putanja, `veće od ${schema.maximum}`));
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(greska(putanja, `manje od ${schema.minItems} stavki`));
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(greska(putanja, `više od ${schema.maxItems} stavki`));
    }
    if (schema.items) {
      value.forEach((item, i) => hodaj(item, schema.items, `${putanja}[${i}]`, errors));
    }
  }

  if (jeObjekat(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(greska(`${putanja}.${key}`, "obavezno polje nedostaje"));
      }
    }
    const poznata = new Set(Object.keys(schema.properties ?? {}));
    /*
     * `additionalProperties: false` je ovde bezbednosno pravilo, ne stil.
     *
     * Bez njega bi klijent mogao da doda `valid: true` ili `validation_status`
     * i time ponudi sopstvenu ocenu ispravnosti. Nepoznato polje se ODBIJA;
     * tiho odbacivanje bi značilo da pošiljalac misli da je nešto poslao.
     */
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!poznata.has(key)) {
          errors.push(greska(`${putanja}.${key}`, "nepoznato polje"));
        }
      }
    }
    for (const [key, podSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        hodaj(value[key], podSchema, `${putanja}.${key}`, errors);
      }
    }
  }
}

function jeObjekat(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function tipOdgovara(value, type) {
  const tipovi = [].concat(type);
  return tipovi.some((t) => {
    switch (t) {
      case "object":
        return jeObjekat(value);
      case "array":
        return Array.isArray(value);
      case "string":
        return typeof value === "string";
      case "integer":
        return typeof value === "number" && Number.isInteger(value);
      case "number":
        return typeof value === "number" && Number.isFinite(value);
      case "boolean":
        return typeof value === "boolean";
      case "null":
        return value === null;
      default:
        throw new SchemaError(`Nepoznat tip „${t}“ u šemi.`);
    }
  });
}
