import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customers } from "./permissions";
import { articles } from "./sales";
import { users } from "./users";

/* =========================================================================
 * Eksterni identitet kupca
 * ====================================================================== */

/**
 * Stanje veze između BizniSoft partnera i kupca u portalu.
 *
 * `unmapped` NIJE greška — to je zatečeno stanje svakog koda koji je stigao iz
 * izvora pre nego što ga je čovek pogledao. `conflict` je jedini oblik u kome
 * sistem sme da stane: nikad ne bira nasumično.
 */
export const externalIdentityStatus = pgEnum("external_identity_status", [
  "unmapped",
  "mapped",
  "conflict",
  "disabled",
]);

export type ExternalIdentityStatus =
  (typeof externalIdentityStatus.enumValues)[number];

/**
 * Šifra partnera iz spoljnog sistema.
 *
 * Zašto zasebna tabela, a ne kolona u `customers`
 * -----------------------------------------------
 * Danas je PIB praktično jedini identitet kupca. PIB je koristan podatak i
 * pomoć kancelariji pri pregledu, ali nije isto što i šifra partnera: jedno
 * pravno lice može imati više partnerskih kartica, a ista šifra u dva izdavaoca
 * ne mora značiti isto lice. Kolona bi ta dva pojma spojila u jedan i time
 * učinila nemogućim da se šifra vodi PRE nego što se zna čija je.
 *
 * `external_partner_code` je `text` i to je poslovno pravilo, ne detalj tipa.
 * `"0012"` i `"12"` su različiti partneri; `Number("0012")` tu razliku trajno
 * gubi. Nigde u lancu se nad ovom vrednošću ne sme pozvati numerički parser.
 */
export const customerExternalIdentifiers = pgTable(
  "customer_external_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * `null` dok je stanje `unmapped` — kod postoji, kupac još nije određen.
     * `restrict`, ne `cascade`: brisanje kupca ne sme tiho progutati njegov
     * spoljni identitet, jer bi isti kod pri sledećem uvozu izgledao kao nov.
     */
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    /** Sistem iz koga kod potiče — danas uvek `biznisoft`. */
    sourceSystem: text("source_system").notNull(),
    /** Opseg izdavaoca (pravno lice/firma iz izvoza), isto polje kao `invoices.company_id`. */
    issuerCode: text("issuer_code").notNull(),
    /** Šifra partnera, tačno kako stoji u izvoru, sa vodećim nulama. */
    externalPartnerCode: text("external_partner_code").notNull(),
    /**
     * Naziv partnera kako ga izvor navodi.
     *
     * Isključivo pomoć čoveku pri pregledu. Nikada ulaz u automatsko
     * povezivanje — sličnost naziva nije dokaz identiteta.
     */
    sourceName: text("source_name"),
    status: externalIdentityStatus("status").notNull().default("unmapped"),
    /** Zašto je veza ovakva; obavezan pri ručnom razrešavanju. */
    note: text("note"),
    /** Popunjeno kada je stanje `conflict` — šta se tačno sudarilo. */
    conflictReason: text("conflict_reason"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedBy: uuid("verified_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /*
     * Jedinstvenost je (izvor, izdavalac, šifra) — ne sama šifra.
     *
     * Ista šifra kod dva izdavaoca je legitimna i ne sme se spojiti; ista
     * šifra kod istog izdavaoca je jedan partner i ne sme postojati dvaput.
     */
    uniqueIndex("customer_external_identifiers_key").on(
      table.sourceSystem,
      table.issuerCode,
      table.externalPartnerCode,
    ),
    index("customer_external_identifiers_customer_idx").on(table.customerId),
    index("customer_external_identifiers_status_idx").on(table.status),
  ],
);

export type CustomerExternalIdentifierRow =
  typeof customerExternalIdentifiers.$inferSelect;

/* =========================================================================
 * BizniSoft artikal ↔ katalog
 * ====================================================================== */

/**
 * Stanje veze artikla i kataloškog proizvoda.
 *
 * `suggested` je predlog jednoznačnog poklapanja po tačnoj šifri — nikad po
 * nazivu — i sam po sebi ne otvara ništa prema kupcu.
 */
export const productMappingStatus = pgEnum("product_mapping_status", [
  "unmapped",
  "suggested",
  "mapped",
  "conflict",
  "rejected",
]);

export type ProductMappingStatus =
  (typeof productMappingStatus.enumValues)[number];

/**
 * Veza između poslovnog artikla (`articles.code`) i kataloškog proizvoda.
 *
 * Nemapiran artikal ostaje potpuno vidljiv kancelariji, gazdi i komercijalisti
 * kao poslovni artikal — on postoji u prometu bez obzira na to da li katalog za
 * njega ima stranicu. Ono što nemapiran artikal NE dobija je slika, PDP i bilo
 * kakav customer-facing link: to bi bila tvrdnja o identitetu proizvoda koju
 * niko nije potvrdio.
 */
export const articleCatalogMappings = pgTable(
  "article_catalog_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    /** Slug kataloškog proizvoda/porodice; `null` dok veza nije određena. */
    catalogProductSlug: text("catalog_product_slug"),
    /** Konkretna varijanta unutar porodice, kada izvor razlikuje varijante. */
    catalogVariantId: text("catalog_variant_id"),
    status: productMappingStatus("status").notNull().default("unmapped"),
    /** Razlog ili napomena; obavezna pri ručnoj potvrdi i poništavanju. */
    note: text("note"),
    /** Šta se sudarilo, kada je stanje `conflict`. */
    conflictReason: text("conflict_reason"),
    proposedBy: uuid("proposed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    proposedAt: timestamp("proposed_at", { withTimezone: true }),
    confirmedBy: uuid("confirmed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /*
     * Najviše jedan ŽIVI red po artiklu.
     *
     * Ovo je brava iza pravila „jedan BizniSoft artikal ne sme tiho pokazivati
     * dva različita katalog proizvoda". Odbijeni redovi ostaju kao istorija i
     * zato ispadaju iz indeksa — inače se isti artikal ne bi mogao ponovo
     * predložiti pošto je jednom odbijen.
     */
    uniqueIndex("article_catalog_mappings_live_key")
      .on(table.articleId)
      .where(sql`status <> 'rejected'`),
    index("article_catalog_mappings_status_idx").on(table.status),
    index("article_catalog_mappings_slug_idx").on(table.catalogProductSlug),
  ],
);

export type ArticleCatalogMappingRow =
  typeof articleCatalogMappings.$inferSelect;
