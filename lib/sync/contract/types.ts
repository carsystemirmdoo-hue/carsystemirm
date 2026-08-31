/**
 * Tipovi canonical payloada — ISKLJUČIVO za prevođenje.
 *
 * Ovo NIJE validator i ne sprovodi nijedno pravilo. Jedini ugovor je
 * `contracts/invoice-ingest/v1/schema.json`; u vreme izvršavanja se proverava
 * samo on, kroz Ajv (`schemaValidator.mjs`). TypeScript tip ovde postoji da bi
 * pozivaoci imali dopunu i proveru pri prevođenju — vrednost koja stigne kroz
 * mrežu ili fajl nema tip i mora proći šemu.
 *
 * Da tip ne bi tiho odlutao od šeme, `CANONICAL_TOP_LEVEL_KEYS` ispod se u
 * testu poredi sa `Object.keys(SCHEMA.properties)`. Kada se šema promeni a tip
 * ne, test pada.
 */

export type CanonicalLine = {
  line_number: number;
  article_code: string;
  description: string | null;
  unit: string | null;
  /** Decimalni tekst sa tačkom. Nikad JSON broj. */
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_percent: string;
  tax_amount: string | null;
  gross_amount: string;
};

export type CanonicalInvoice = {
  schema_version: number;
  canonicalization_version: number;
  parser_version: string;
  source_system: "biznisoft";
  issuer: { code: string };
  document: {
    kind: string;
    number: string;
    business_year?: number;
    issued_on: string;
    trade_date: string | null;
    date_basis: "issued_on" | "trade_date";
    currency: string;
  };
  partner: { external_code: string };
  totals: { printed_gross_total: string };
  lines: CanonicalLine[];
  parser_meta: { page_count: number; line_count: number };
  source_hash: string;
  semantic_hash: string;
};

/**
 * Polja najvišeg nivoa, radi provere da tip prati šemu.
 *
 * Redosled je nebitan — test poredi skupove.
 */
export const CANONICAL_TOP_LEVEL_KEYS = [
  "schema_version",
  "canonicalization_version",
  "parser_version",
  "source_system",
  "issuer",
  "document",
  "partner",
  "totals",
  "lines",
  "parser_meta",
  "source_hash",
  "semantic_hash",
] as const;
