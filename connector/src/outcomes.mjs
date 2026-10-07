/**
 * Matrica: STVARNI P2 ishod → lokalno stanje.
 *
 * Kodovi i statusi su prepisani iz koda, ne iz izveštaja:
 *   `lib/sync/http/handler.ts`, `app/api/sync/ingest/route.ts`,
 *   `lib/sync/device/authenticate.ts`, `lib/sync/contract/validate.mjs`,
 *   `lib/sync/http/gate.ts`.
 *
 * Odluka se vezuje za `code` i HTTP status, NIKAD za tekst poruke. Poruke su
 * namerno ujednačene na serveru (da odgovor ne postane pretraživač uređaja), pa
 * bi grananje po tekstu bilo granjanje po nečemu što se sme promeniti bez
 * najave.
 *
 * Dva ključna detalja koja se lako promaše:
 *
 *  - `ok: true` u odgovoru NIJE dokaz knjiženja. Ruta vraća `ok: true` i za
 *    ishode koje je server sačuvao za PREGLED (HTTP 409). Zato se ovde gleda
 *    `code`.
 *  - HTTP 409 nosi DVE različite stvari: `nonce_replayed` (ponovi sa novim
 *    nonce-om) i ishode za pregled (ne ponavljaj). Status sam po sebi nije
 *    dovoljan.
 */

/**
 * Lokalna stanja stavke u redu.
 *
 * Namerno se razlikuju „potvrđeno knjiženo“ i „server sačuvao za pregled“:
 * spajanje bi značilo da izveštaj konektora kaže „poslato“ za dokument koji
 * čeka čoveka.
 */
export const STANJA = Object.freeze({
  /** Spremno za slanje. */
  SPREMNO: "spremno",
  /** Slanje u toku; posle pada procesa se vraća u `spremno`. */
  SALJE_SE: "salje_se",
  /** Server je knjižio ili prepoznao isti dokument. Završno. */
  POTVRDJENO: "potvrdjeno",
  /** Server je primio i sačuvao za ljudski pregled. Završno za konektor. */
  ZA_PREGLED: "za_pregled",
  /** Privremeni problem; ponavlja se najranije sledećeg radnog dana. */
  ODLOZENO: "odlozeno",
  /** Sadržaj koji server neće primiti ni posle ponavljanja. Traži čoveka. */
  ODBIJENO: "odbijeno",
  /** Lokalno nepodržan ili nečitljiv dokument; ne šalje se. */
  NEPODRZANO: "nepodrzano",
  /** Podešavanje/ovlašćenje; sve slanje staje dok se ne interveniše. */
  BLOKIRANO: "blokirano",
});

/** Stanja iz kojih se stavka više ne uzima u obradu. */
export const ZAVRSNA = Object.freeze([
  STANJA.POTVRDJENO,
  STANJA.ZA_PREGLED,
  STANJA.ODBIJENO,
  STANJA.NEPODRZANO,
]);

/**
 * Da li ishod zaustavlja CEO ciklus, ne samo tu stavku.
 *
 * Opozvan uređaj, neispravan potpis ili isključen gate ne popravljaju se
 * sledećom stavkom. Nastavljanje bi značilo N identičnih odbijanja i N zapisa
 * u serverskom rate-limitu.
 */
export const ZAUSTAVLJA_CIKLUS = "zaustavi_ciklus";

/**
 * Kodovi koji znače „server je knjižio ili već ima isti dokument“.
 *
 * `duplicate_file` je ovde namerno: to je dokaz da je isti otisak već primljen,
 * i to je tačno ono što treba posle izgubljenog odgovora.
 */
const POTVRDA = new Set(["ingested", "duplicate_file"]);

/**
 * Server je primio i sačuvao za pregled.
 *
 * NE prikazuje se kao knjiženo i NE ponavlja se: dokument je kod servera i čeka
 * čoveka. Ponavljanje bi svaki dan pravilo isti zapis.
 */
const ZA_PREGLED_KODOVI = new Set([
  "business_key_conflict",
  "already_imported_other_source",
  "source_hash_content_mismatch",
  /*
   * Nemapiran kupac i karantin su TAKOĐE „kod servera, čeka čoveka“.
   *
   * Bez njih su padali u „nepoznat kod“ i odlagali se za sledeći radni dan —
   * a mapiranje partnera ne nastaje samo od sebe. Posledica je bila dvostruko
   * pogrešna: jedno beskorisno ponovno slanje, i prikaz „čeka retry“ umesto
   * „traži pregled“, pa niko ne bi znao da treba nešto da uradi.
   */
  "awaiting_customer_mapping",
  "quarantined",
]);

/**
 * Sadržaj koji server odbija (HTTP 422, `ContractRejection`).
 *
 * Ponavljanje ne pomaže — isti bajtovi daju isti ishod. Traži čoveka ili nov
 * dokument. Ovo NISU greške konektora nego granice podržanog podskupa.
 */
const ODBIJEN_SADRZAJ = new Set([
  "schema_invalid",
  "schema_version_unsupported",
  "canonicalization_version_unsupported",
  "parser_version_unsupported",
  "document_kind_unsupported",
  "currency_unsupported",
  "date_basis_unsupported",
  "trade_date_unsupported",
  "date_basis_mismatch",
  "business_year_mismatch",
  "issued_on_invalid",
  "line_numbers_duplicated",
  "line_numbers_not_sequential",
  "line_count_mismatch",
  "decimal_invalid",
  "line_arithmetic_mismatch",
  "totals_mismatch",
  "semantic_hash_mismatch",
]);

/**
 * Podešavanje ili ovlašćenje — zaustavlja ceo ciklus.
 *
 * `issuer_mismatch` je ovde, a ne u odbijenom sadržaju: znači da je uređaj
 * registrovan za drugog izdavaoca. To se NE popravlja menjanjem payloada —
 * konektor nikada ne sme da promeni issuer da bi zahtev prošao.
 */
const BLOKADA = new Set([
  "unknown_device",
  "device_not_active",
  "algorithm_unsupported",
  "signature_invalid",
  "body_hash_mismatch",
  "version_unsupported",
  "identifier_invalid",
  "header_missing",
  "header_invalid",
  "nonce_invalid",
  "body_hash_invalid",
  "signature_invalid_format",
  "path_invalid",
  "query_not_allowed",
  "issuer_mismatch",
  "not_found",
  "method_not_allowed",
]);

/**
 * Odlučuje šta konektor radi sa jednim odgovorom.
 *
 * @param {{ httpStatus: number, code: string | null, ok?: boolean }} odgovor
 * @returns {{ stanje: string, ponovi: boolean, ciklus?: string, razlog: string }}
 */
export function odlukaZaOdgovor(odgovor) {
  const kod = typeof odgovor.code === "string" ? odgovor.code : null;

  /*
   * Bez prepoznatog koda NEMA potvrde — ni na HTTP 200.
   *
   * HTML stranica sa 200, prazno telo ili tuđi JSON su sve „nepoznat odgovor“.
   * Upisati potvrdu na osnovu statusa značilo bi da posrednik koji vrati
   * captive-portal stranicu obriše dokument iz reda.
   */
  if (!kod) {
    return {
      stanje: STANJA.ODLOZENO,
      ponovi: true,
      razlog: "nepoznat_odgovor",
    };
  }

  if (odgovor.httpStatus === 200 && POTVRDA.has(kod)) {
    return { stanje: STANJA.POTVRDJENO, ponovi: false, razlog: kod };
  }

  if (ZA_PREGLED_KODOVI.has(kod)) {
    return { stanje: STANJA.ZA_PREGLED, ponovi: false, razlog: kod };
  }

  /*
   * Replay: server je već obradio ovaj nonce.
   *
   * Stavka se ponavlja, ali sa NOVIM nonce-om i timestamp-om — nikad sa istim.
   * Ovo je normalno posle pada usred slanja.
   */
  if (kod === "nonce_replayed") {
    return { stanje: STANJA.SPREMNO, ponovi: true, razlog: "nonce_replayed" };
  }

  if (kod === "timestamp_out_of_window") {
    /*
     * Sat je pomeren. Ponavljanje bez intervencije bi svaki put palo isto.
     *
     * Konektor NE menja sistemsko vreme i ne traži šire prozore od servera —
     * prijavljuje razliku i staje.
     */
    return {
      stanje: STANJA.BLOKIRANO,
      ponovi: false,
      ciklus: ZAUSTAVLJA_CIKLUS,
      razlog: "sat_van_prozora",
    };
  }

  if (BLOKADA.has(kod)) {
    return {
      stanje: STANJA.BLOKIRANO,
      ponovi: false,
      ciklus: ZAUSTAVLJA_CIKLUS,
      razlog: kod,
    };
  }

  if (odgovor.httpStatus === 422 && ODBIJEN_SADRZAJ.has(kod)) {
    return { stanje: STANJA.ODBIJENO, ponovi: false, razlog: kod };
  }

  if (kod === "rate_limited" || odgovor.httpStatus === 429) {
    return { stanje: STANJA.ODLOZENO, ponovi: true, ciklus: ZAUSTAVLJA_CIKLUS, razlog: "rate_limited" };
  }

  if (odgovor.httpStatus >= 500 || kod === "temporarily_unavailable" || kod === "ingest_failed") {
    return { stanje: STANJA.ODLOZENO, ponovi: true, razlog: kod };
  }

  /*
   * Telo/format koje server odbija pre autentifikacije.
   *
   * Ponavljanje ne pomaže, ali ovo je greška KONEKTORA, ne dokumenta — pa ide
   * u odbijeno sa svojim kodom, da se vidi u statusu.
   */
  if (
    ["body_too_large", "body_not_json", "body_not_utf8", "content_type_unsupported",
     "encoding_unsupported", "content_length_invalid", "body_unreadable"].includes(kod)
  ) {
    return { stanje: STANJA.ODBIJENO, ponovi: false, razlog: kod };
  }

  /*
   * Prepoznat oblik odgovora, nepoznat kod.
   *
   * Nikad automatska potvrda. Odlaže se i beleži kod, da se posle nadogradnje
   * servera vidi šta je stiglo.
   */
  return { stanje: STANJA.ODLOZENO, ponovi: true, razlog: `nepoznat_kod:${kod}` };
}

/**
 * `Retry-After` u sekundama, ograničeno.
 *
 * Koristi ga oporavak u toku ciklusa (`retry.mjs`): kratko čekanje se odčeka,
 * duže zaustavlja ciklus do zadatog trenutka. Raspored `auto` (jednom dnevno)
 * se time ne menja — ciklus se ne pokreće češće, samo se ne odlaže ceo dan.
 *
 * @returns {number | null} sekunde, ograničeno na [0, 86400]
 */
export function ogranicenRetryAfter(zaglavlje) {
  if (typeof zaglavlje !== "string" || zaglavlje.trim() === "") return null;
  const n = Number(zaglavlje.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), 86400);
}
