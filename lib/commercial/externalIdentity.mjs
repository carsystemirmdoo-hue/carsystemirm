/**
 * Pravila spoljnog identiteta kupca — čista logika, bez baze.
 *
 * Odvojeno od upisa da bi se pravilo „vodeća nula je deo šifre" moglo dokazati
 * testom, a ne obećanjem u komentaru.
 */

/** Sistemi iz kojih šifra partnera sme da stigne. */
export const SOURCE_SYSTEMS = ["biznisoft"];

export const EXTERNAL_IDENTITY_STATUSES = [
  "unmapped",
  "mapped",
  "conflict",
  "disabled",
];

/**
 * Dozvoljen oblik šifre partnera.
 *
 * Namerno širi od `^\d+$`: izvor sme da vodi i alfanumeričke šifre, a sužavanje
 * na cifre bi tiho odbacilo legitimnog partnera. Zabranjeno je ono što bi
 * pokvarilo poređenje — razmak unutar šifre i kontrolni znakovi.
 */
const CODE_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,63}$/;

export class ExternalIdentityError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "ExternalIdentityError";
    this.code = code;
  }
}

/**
 * Priprema šifru partnera za poređenje i upis.
 *
 * Uklanja se ISKLJUČIVO okolni razmak. Vodeće nule ostaju: `"0012"` i `"12"` su
 * različiti partneri, i nijedna transformacija u ovom lancu ne sme ih
 * izjednačiti. Zato ovde nema ni `Number`, ni `parseInt`, ni `replace(/^0+/, "")`.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizePartnerCode(raw) {
  if (typeof raw !== "string") {
    throw new ExternalIdentityError(
      "Šifra partnera mora biti tekst — brojčani oblik gubi vodeće nule.",
      "not_a_string",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ExternalIdentityError("Šifra partnera je prazna.", "empty");
  }
  if (!CODE_SHAPE.test(trimmed)) {
    throw new ExternalIdentityError(
      `Šifra partnera „${trimmed}" nije u dozvoljenom obliku.`,
      "bad_shape",
    );
  }
  return trimmed;
}

/**
 * Ključ jedinstvenosti: izvor + izdavalac + šifra.
 *
 * Ista šifra kod dva izdavaoca je legitimna i ne sme se spojiti — zato izdavalac
 * ulazi u ključ, a ne stoji sa strane.
 *
 * @param {{ sourceSystem: string, issuerCode: string, externalPartnerCode: string }} input
 * @returns {string}
 */
export function identityKey(input) {
  const source = String(input.sourceSystem ?? "")
    .trim()
    .toLowerCase();
  if (!SOURCE_SYSTEMS.includes(source)) {
    throw new ExternalIdentityError(
      `Nepoznat izvorni sistem „${input.sourceSystem}".`,
      "unknown_source",
    );
  }
  const issuer = String(input.issuerCode ?? "").trim();
  if (issuer.length === 0) {
    throw new ExternalIdentityError(
      "Izdavalac (company scope) je obavezan.",
      "empty_issuer",
    );
  }
  /*
   * Izdavalac ide kroz isti oblik kao i sama šifra. Bez toga bi razmak unutar
   * izdavaoca mogao da premesti granicu u ključu, pa bi se ("01 02", "3") i
   * ("01", "02 3") sudarili kao isti partner.
   */
  if (!CODE_SHAPE.test(issuer)) {
    throw new ExternalIdentityError(
      `Izdavalac „${issuer}" nije u dozvoljenom obliku.`,
      "bad_shape",
    );
  }
  /*
   * Razmak kao razdvajač: ne može se pojaviti ni u jednom od tri dela (izvor je
   * iz zatvorene liste, izdavalac i šifra su trimovani i bez unutrašnjeg
   * razmaka), pa se ključevi ("a", "b c") i ("a b", "c") ne mogu sudariti.
   */
  return [source, issuer, normalizePartnerCode(input.externalPartnerCode)].join(
    " ",
  );
}

/**
 * Da li dve šifre označavaju istog partnera.
 *
 * Isključivo tačno poklapanje teksta. Sličnost, prefiks i numerička jednakost
 * nisu dokaz — `"0012"` i `"12"` vraćaju `false`.
 *
 * @param {string} a @param {string} b
 */
export function isSamePartnerCode(a, b) {
  return normalizePartnerCode(a) === normalizePartnerCode(b);
}

/**
 * Šta uraditi sa dolaznom šifrom, u odnosu na ono što već stoji u bazi.
 *
 * Vraća odluku, ne izvršava je — pozivalac je taj koji piše i upisuje trag.
 *
 * @param {object} input
 * @param {{ sourceSystem: string, issuerCode: string, externalPartnerCode: string, customerId?: string | null }} input.incoming
 * @param {{ id: string, customerId: string | null, status: string } | null} input.existing
 *   red koji već nosi isti ključ, ili `null`
 * @returns {{ action: "create" | "noop" | "attach" | "conflict", reason?: string }}
 */
export function decideIdentityWrite({ incoming, existing }) {
  identityKey(incoming); // baca na neispravan oblik pre ijedne odluke
  const wanted = incoming.customerId ?? null;

  if (!existing) return { action: "create" };

  if (existing.status === "disabled") {
    return {
      action: "conflict",
      reason:
        "Šifra je ranije isključena. Ponovno uvođenje traži ručnu odluku, da isključenje ne bi bilo poništeno uvozom.",
    };
  }

  if (wanted === null) return { action: "noop" };
  if (existing.customerId === null) return { action: "attach" };
  if (existing.customerId === wanted) return { action: "noop" };

  return {
    action: "conflict",
    reason:
      "Ista šifra partnera već pokazuje na drugog kupca. Sistem ne bira između dva kupca — vezu razrešava čovek.",
  };
}

/**
 * Kandidati za ručni pregled, po TAČNOJ šifri.
 *
 * Funkcija namerno ne prima naziv i ne postoji varijanta koja ga prima. Spajanje
 * po sličnom nazivu je najbrži put do toga da jedan kupac vidi tuđe cene, a
 * greška se ne primeti jer izgleda kao tačan rezultat.
 *
 * @template {{ sourceSystem: string, issuerCode: string, externalPartnerCode: string }} T
 * @param {readonly T[]} rows
 * @param {{ sourceSystem: string, issuerCode: string, externalPartnerCode: string }} query
 * @returns {T[]}
 */
export function matchByExactCode(rows, query) {
  const key = identityKey(query);
  return rows.filter((row) => {
    try {
      return identityKey(row) === key;
    } catch {
      return false;
    }
  });
}

/**
 * Da li se PIB sme upotrebiti kao osnov automatskog spajanja.
 *
 * Uvek `false`, i postoji da bi odgovor bio na jednom mestu i pod testom.
 * PIB ostaje vredan podatak za pregled kancelarije: dva reda sa istim PIB-om
 * vredi pokazati čoveku. Ali PIB nije šifra partnera, i jedan PIB legitimno
 * nosi više partnerskih kartica.
 */
export function pibIsAutoMergeEvidence() {
  return false;
}
