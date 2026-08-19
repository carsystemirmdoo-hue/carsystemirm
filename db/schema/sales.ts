import {
  bigserial,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./permissions";
import { users } from "./users";

/**
 * Vrsta dokumenta onako kako je izvor navodi.
 *
 * `nepoznato` nije rezerva za lenjost — koristi se isključivo kada izvor ne daje
 * vrstu. Tada se u interfejsu prikazuje „Vrsta negativnog dokumenta nije poznata
 * iz izvora“ umesto pretpostavke.
 */
export const documentKind = pgEnum("document_kind", [
  "faktura",
  "povrat_robe",
  "storno",
  "knjizno_odobrenje",
  "korekcija_cene",
  "korekcija_popusta",
  "nepoznato",
]);

export type DocumentKind = (typeof documentKind.enumValues)[number];

/** Artikli iz izvoza. Šifra je poslovni identitet. */
export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    productGroup: text("product_group"),
    brand: text("brand"),
    unit: text("unit"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("articles_code_key").on(table.code)],
);

/**
 * Komercijalista iz izvoza. Vezuje se na nalog kada se poklope, ali postoji i
 * bez naloga — u fakturama se pojavljuju i ljudi koji nemaju pristup sistemu.
 */
export const salespeople = pgTable(
  "salespeople",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceCode: text("source_code").notNull(),
    name: text("name").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("salespeople_source_code_key").on(table.sourceCode)],
);

/**
 * Faktura.
 *
 * Identitet je (pravno lice, vrsta dokumenta, broj, godina) — nikada redni broj
 * u fajlu ni pozicija u folderu. Zahvaljujući tome ponovni uvoz istog dokumenta
 * pogađa isti red umesto da napravi duplikat.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id").notNull(),
    documentKind: documentKind("document_kind").notNull(),
    /** Oznaka vrste tačno kako stoji u izvoru; čuva se i kada je ne prepoznajemo. */
    sourceDocumentType: text("source_document_type"),
    number: text("number").notNull(),
    year: integer("year").notNull(),
    issuedOn: date("issued_on").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    salespersonId: uuid("salesperson_id").references(() => salespeople.id, {
      onDelete: "set null",
    }),
    /** Negativni iznosi se čuvaju kakvi jesu — ne pretvaraju se u apsolutnu vrednost. */
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    /**
     * Podaci o plaćanju NAMERNO ne postoje u ovoj tabeli. Fakture ih ne sadrže,
     * pa bi svaka kolona tipa `placeno` ili `otvoreno` bila izmišljena vrednost.
     */
    importRunId: bigserial("import_run_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_identity_key").on(
      table.companyId,
      table.documentKind,
      table.number,
      table.year,
    ),
    index("invoices_customer_idx").on(table.customerId),
    index("invoices_issued_idx").on(table.issuedOn),
    index("invoices_salesperson_idx").on(table.salespersonId),
  ],
);

/** Stavka fakture. Negativna količina i iznos su dozvoljeni i očekivani. */
export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    lineNumber: integer("line_number").notNull(),
    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    articleCode: text("article_code").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull(),
    discountPercent: numeric("discount_percent", { precision: 6, scale: 3 })
      .notNull()
      .default("0"),
    taxPercent: numeric("tax_percent", { precision: 6, scale: 3 })
      .notNull()
      .default("0"),
    lineAmount: numeric("line_amount", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex("invoice_lines_identity_key").on(
      table.invoiceId,
      table.lineNumber,
    ),
    index("invoice_lines_article_idx").on(table.articleId),
  ],
);
