import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { importRuns } from "./imports";
import { documentKind, invoices } from "./sales";
import { users } from "./users";

/**
 * Ishod provere jednog izvornog dokumenta.
 *
 * `unsupported_requires_sample` nije greška nego iskrena izjava: dokument nosi
 * oblik za koji NE POSTOJI stvaran uzorak, pa parser nema pravilo koje bi mogao
 * da primeni. Bez ove vrednosti bi jedini izbor bio nagađanje ili tiho
 * odbacivanje, a oba proizvode netačan ledger.
 */
export const sourceDocumentValidation = pgEnum("source_document_validation", [
  "valid",
  /** Odštampan zbir se ne poklapa sa izračunatim. Nikad tiho ne postaje faktura. */
  "totals_mismatch",
  /** Tekst se ne može pročitati ili zaglavlje nije BizniSoft. */
  "unparsable",
  /** Oblik koji realni uzorci ne dokazuju — vidi `16-biznisoft-pdf-evidence-audit.md`. */
  "unsupported_requires_sample",
]);

/**
 * Odnos dokumenta prema drugim verzijama istog poslovnog dokumenta.
 *
 * `conflict` je namerno ravnopravno stanje: dva dokumenta tvrde da su isti
 * poslovni dokument, a sistem NE bira. Biranje „poslednjeg" po vremenu izmene
 * fajla je pogađanje koje izgleda kao odluka.
 */
export const sourceDocumentRevision = pgEnum("source_document_revision", [
  "original",
  "superseded",
  "conflict",
  "pending_review",
]);

export const manualReviewStatus = pgEnum("manual_review_status", [
  "not_required",
  "pending",
  "resolved",
]);

export type SourceDocumentValidation =
  (typeof sourceDocumentValidation.enumValues)[number];
export type SourceDocumentRevision =
  (typeof sourceDocumentRevision.enumValues)[number];
export type ManualReviewStatus = (typeof manualReviewStatus.enumValues)[number];

/**
 * Jedan uvezen PDF, sa svim što je o njemu utvrđeno.
 *
 * Zašto zaseban sloj iznad `invoices`
 * -----------------------------------
 * `invoices` je poslovna istina — jedan red po fakturi. Izvorni dokument je
 * ARTEFAKT: fajl koji je neko uploadovao, sa svojim otiskom, verzijom parsera i
 * ishodom provere. Isti poslovni dokument može doći kroz više fajlova
 * (ponovni upload, revizija), a fajl koji ne prođe proveru uopšte ne sme da
 * napravi fakturu.
 *
 * Spajanje to dvoje značilo bi ili da `invoices` dobija kolone o fajlovima, ili
 * da neuspeli uvoz ostavlja polupraznu fakturu. Oba oblika kvare jedini ledger.
 */
export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /* --- artefakt --- */
    /** SHA-256 sadržaja. Jedini pouzdan identitet fajla; ime se menja. */
    fileHash: text("file_hash").notNull(),
    /**
     * Ime fajla kakvo je stiglo.
     *
     * Čuva se radi prepoznavanja u redu za pregled, ali se NIKADA ne koristi
     * kao identitet — ime nosi broj dokumenta i lako se preimenuje.
     */
    fileName: text("file_name").notNull(),
    pageCount: integer("page_count").notNull(),
    lineCount: integer("line_count").notNull().default(0),

    /* --- poslovni identitet --- */
    /** Izdavalac (pravno lice); isti opseg kao `invoices.company_id`. */
    issuerCode: text("issuer_code").notNull(),
    /** Ponovo se koristi postojeći rečnik iz `sales.ts`, bez novog. */
    businessDocumentType: documentKind("business_document_type").notNull(),
    businessDocumentNumber: text("business_document_number"),
    /**
     * Šifra partnera sa dokumenta, tekst, sa vodećim nulama.
     *
     * Postoji da bi dokument koji čeka mapiranje mogao da se proknjiži kada
     * čovek poveže šifru sa kupcem, bez ponovnog čitanja PDF-a. Original se
     * posle uvoza više ne dodiruje.
     */
    externalPartnerCode: text("external_partner_code"),
    documentDate: date("document_date"),

    /* --- obrada --- */
    ingestionRunId: integer("ingestion_run_id").references(() => importRuns.id, {
      onDelete: "restrict",
    }),
    /**
     * Verzija parsera koja je proizvela ovaj rezultat.
     *
     * Bez nje se posle izmene parsera ne može odgovoriti koji su dokumenti
     * pročitani starim pravilima — a to je prvo pitanje kad se pojavi greška.
     */
    parserVersion: text("parser_version").notNull(),
    validationStatus: sourceDocumentValidation("validation_status").notNull(),
    /** Čitljiv razlog kada provera nije prošla; bez sirovog teksta dokumenta. */
    validationDetail: text("validation_detail"),

    /* --- revizija --- */
    revisionStatus: sourceDocumentRevision("revision_status")
      .notNull()
      .default("original"),
    supersedesId: uuid("supersedes_id"),
    supersededById: uuid("superseded_by_id"),
    conflictReason: text("conflict_reason"),
    /** Ko je i kada potvrdio vezu revizije; obavezno uz `superseded`. */
    revisionConfirmedBy: uuid("revision_confirmed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    revisionConfirmedAt: timestamp("revision_confirmed_at", { withTimezone: true }),

    /* --- ručni pregled --- */
    manualReview: manualReviewStatus("manual_review").notNull().default("not_required"),
    manualReviewNote: text("manual_review_note"),
    manualReviewBy: uuid("manual_review_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    manualReviewAt: timestamp("manual_review_at", { withTimezone: true }),

    /**
     * Faktura koju je ovaj dokument proizveo.
     *
     * `null` dok dokument nije prošao proveru — i to je poenta: neispravan
     * dokument je vidljiv kancelariji, a nijedan red prometa nije nastao.
     */
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /*
     * Isti fajl ne može ući dvaput.
     *
     * Ovo je brava iza idempotentnosti; aplikativna provera ne preživljava dva
     * paralelna uploada istog fajla.
     */
    uniqueIndex("source_documents_file_hash_key").on(table.fileHash),
    /*
     * Poslovni ključ NIJE jedinstven — namerno.
     *
     * Dva fajla smeju tvrditi da su isti poslovni dokument; to je upravo
     * situacija koju treba PRIMETITI i staviti u `conflict`, a ne zabraniti na
     * nivou baze i time izgubiti dokaz da se desila.
     */
    index("source_documents_business_key_idx").on(
      table.issuerCode,
      table.businessDocumentType,
      table.businessDocumentNumber,
    ),
    index("source_documents_validation_idx").on(table.validationStatus),
    index("source_documents_review_idx").on(table.manualReview),
    index("source_documents_invoice_idx").on(table.invoiceId),
  ],
);

export type SourceDocumentRow = typeof sourceDocuments.$inferSelect;

/**
 * Jedna izdvojena stavka, onako kako je pročitana iz PDF-a.
 *
 * Postoji odvojeno od `invoice_lines` zato što nosi i SIROVI izdvojeni tekst uz
 * normalizovanu vrednost. Kad se kasnije pojavi neslaganje, jedino pitanje koje
 * vredi je „šta je u dokumentu stvarno pisalo" — a to `invoice_lines` ne čuva
 * i ne treba da čuva.
 */
export const sourceDocumentLines = pgTable(
  "source_document_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "cascade" }),
    lineNumber: integer("line_number").notNull(),

    /** Šifra artikla kao TEKST — vodeće nule su deo vrednosti. */
    articleCode: text("article_code"),
    description: text("description"),
    unit: text("unit"),

    /** Normalizovane vrednosti; `null` kada red nije pouzdano pročitan. */
    quantity: text("quantity"),
    unitPrice: text("unit_price"),
    discountPercent: text("discount_percent"),
    taxPercent: text("tax_percent"),
    taxAmount: text("tax_amount"),
    grossAmount: text("gross_amount"),

    /**
     * Sirov izdvojen tekst reda, po kolonama.
     *
     * Ne prikazuje se kupcu i ne ulazi u logove; služi kancelariji pri
     * razrešavanju spora oko pročitane vrednosti.
     */
    rawCells: text("raw_cells"),
    /** `ok` ili opis zašto red nije pouzdan. */
    lineStatus: text("line_status").notNull().default("ok"),
  },
  (table) => [
    uniqueIndex("source_document_lines_key").on(
      table.sourceDocumentId,
      table.lineNumber,
    ),
    index("source_document_lines_article_idx").on(table.articleCode),
  ],
);

export type SourceDocumentLineRow = typeof sourceDocumentLines.$inferSelect;
