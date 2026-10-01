import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customerExternalIdentifiers } from "./commercial";
import { customerUsers } from "./customer-accounts";
import { customers } from "./permissions";
import { users } from "./users";

/* =========================================================================
 * Registar BizniSoft partnera (migracija 0028)
 * ====================================================================== */

export const partnerPibStatus = pgEnum("partner_pib_status", [
  "valid",
  "invalid_checksum",
  "nonstandard",
  "missing",
]);

/**
 * `rep_assigned_candidate` znači samo „kartica ima šifru komercijaliste".
 * Nije dokaz kupovine — kupca potvrđuje prodajni dokument.
 */
export const partnerClassification = pgEnum("partner_classification", [
  "rep_assigned_candidate",
  "needs_review",
]);

/** Jedan uvezen fajl matičnih podataka partnera. */
export const partnerImports = pgTable(
  "partner_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceSystem: text("source_system").notNull(),
    issuerCode: text("issuer_code").notNull(),
    /** Profil strukture izvoza, npr. `prep_workbook_v1`. */
    profile: text("profile").notNull(),
    fileName: text("file_name").notNull(),
    fileSha256: text("file_sha256").notNull(),
    partnerCount: integer("partner_count").notNull(),
    /** Sažetak i nalazi analize — bez e-pošte i telefona. */
    summary: jsonb("summary").notNull(),
    importedBy: uuid("imported_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("partner_imports_file_key").on(
      table.sourceSystem,
      table.issuerCode,
      table.fileSha256,
    ),
  ],
);

export type PartnerImportRow = typeof partnerImports.$inferSelect;

/**
 * Kartica partnera kako je stajala u jednom uvozu.
 *
 * Snimak, ne tekuće stanje: tekuće je poslednji uvoz (pogled
 * `current_partner_records`). Tako promena naziva ili PIB-a pod istom šifrom
 * ostaje vidljiva poređenjem dva uvoza.
 */
export const partnerRecords = pgTable(
  "partner_records",
  {
    importId: uuid("import_id")
      .notNull()
      .references(() => partnerImports.id, { onDelete: "cascade" }),
    partnerCode: text("partner_code").notNull(),
    name: text("name").notNull(),
    pib: text("pib"),
    pibStatus: partnerPibStatus("pib_status").notNull(),
    city: text("city"),
    address: text("address"),
    /** Iz izvora. NIJE ovlašćeni kontakt i sam ne otvara nalog. */
    emailRaw: text("email_raw"),
    emails: text("emails").array().notNull().default(sql`'{}'::text[]`),
    phoneRaw: text("phone_raw"),
    repCode: text("rep_code"),
    activeInSource: boolean("active_in_source"),
    classification: partnerClassification("classification").notNull(),
    sourceSheet: text("source_sheet").notNull(),
    sourceRow: integer("source_row").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importId, table.partnerCode] }),
    index("partner_records_pib_idx").on(table.pib),
  ],
);

export type PartnerRecordRow = typeof partnerRecords.$inferSelect;

/* =========================================================================
 * Potvrda ovlašćene osobe (migracija 0028)
 * ====================================================================== */

export const contactVerificationMethod = pgEnum("contact_verification_method", [
  "callback_known_number",
  "signed_authorization",
  "in_person",
]);

export const contactSource = pgEnum("contact_source", [
  "biznisoft_partner_record",
  "provided_by_company",
  "provided_by_sales_rep",
  "public_business_listing",
]);

/**
 * Dokaz da osoba koja kontroliše `verified_email` sme da vidi podatke firme.
 *
 * Samo za dodavanje: okidač odbija brisanje i izmenu sadržaja. Jedina izmena
 * je opoziv. Pravila za poziv: `lib/customers/contactVerification.mjs`.
 */
export const customerContactVerifications = pgTable(
  "customer_contact_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerUserId: uuid("customer_user_id").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    basisIdentifierId: uuid("basis_identifier_id")
      .notNull()
      .references(() => customerExternalIdentifiers.id, { onDelete: "restrict" }),
    verifiedEmail: text("verified_email").notNull(),
    personRole: text("person_role").notNull(),
    method: contactVerificationMethod("method").notNull(),
    contactSource: contactSource("contact_source").notNull(),
    sourceReference: text("source_reference"),
    evidenceNote: text("evidence_note").notNull(),
    verifiedBy: uuid("verified_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    foreignKey({
      name: "customer_contact_verifications_account_fk",
      columns: [table.customerUserId, table.customerId],
      foreignColumns: [customerUsers.id, customerUsers.customerId],
    }).onDelete("restrict"),
    uniqueIndex("customer_contact_verifications_live_key")
      .on(table.customerUserId)
      .where(sql`revoked_at IS NULL`),
    index("customer_contact_verifications_customer_idx").on(table.customerId),
  ],
);

export type CustomerContactVerificationRow =
  typeof customerContactVerifications.$inferSelect;
