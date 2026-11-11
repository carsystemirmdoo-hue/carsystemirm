import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./permissions";
import { users } from "./users";

/**
 * Alati komercijaliste (0061). Upiti su u `lib/sales-tools/*`; ovde je samo oblik tabela.
 */

/** Telefon i kontakt osoba kupca kako ih zna komercijalista. */
export const customerSalesContacts = pgTable("customer_sales_contacts", {
  customerId: uuid("customer_id")
    .primaryKey()
    .references(() => customers.id, { onDelete: "restrict" }),
  contactName: text("contact_name"),
  phone: text("phone"),
  phoneAlt: text("phone_alt"),
  email: text("email"),
  note: text("note"),
  updatedBy: uuid("updated_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Beleška posle razgovora; ne menja se, podsetnik se završava jednom. */
export const customerCallNotes = pgTable(
  "customer_call_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    outcome: text("outcome").notNull(),
    body: text("body"),
    followUpOn: date("follow_up_on"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    followUpDoneAt: timestamp("follow_up_done_at", { withTimezone: true }),
    followUpDoneBy: uuid("follow_up_done_by").references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("customer_call_notes_customer_idx").on(table.customerId, table.createdAt),
    index("customer_call_notes_follow_up_idx")
      .on(table.followUpOn)
      .where(sql`${table.followUpOn} IS NOT NULL AND ${table.followUpDoneAt} IS NULL`),
  ],
);

/** Jedno čitanje tabele dugovanja (Google tabela ili otpremljen fajl). */
export const receivableSnapshots = pgTable(
  "receivable_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    sourceRef: text("source_ref").notNull(),
    contentSha256: text("content_sha256").notNull(),
    rowCount: integer("row_count").notNull(),
    matchedCount: integer("matched_count").notNull(),
    totalRemaining: numeric("total_remaining", { precision: 16, scale: 2 }).notNull(),
    warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("receivable_snapshots_created_idx").on(table.createdAt)],
);

/** Otvorena ili delimično plaćena faktura iz snimka. */
export const receivableLines = pgTable(
  "receivable_lines",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => receivableSnapshots.id, { onDelete: "restrict" }),
    rowNumber: integer("row_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    customerLabel: text("customer_label").notNull(),
    pib: text("pib"),
    partnerCode: text("partner_code"),
    invoiceNumber: text("invoice_number"),
    issuedOn: date("issued_on"),
    dueOn: date("due_on"),
    amount: numeric("amount", { precision: 16, scale: 2 }),
    paid: numeric("paid", { precision: 16, scale: 2 }),
    remaining: numeric("remaining", { precision: 16, scale: 2 }).notNull(),
    note: text("note"),
    /** 0062: naziv tabele (komercijalista) i normalizovan naziv kupca. */
    sourceLabel: text("source_label"),
    labelKey: text("label_key"),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.rowNumber] }),
    index("receivable_lines_customer_idx").on(table.snapshotId, table.customerId),
  ],
);

/** 0062: ručna veza „naziv kupca iz tabele → kupac“; ima prednost nad automatskim poklapanjem. */
export const receivableCustomerLinks = pgTable("receivable_customer_links", {
  labelKey: text("label_key").primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  labelExample: text("label_example").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 0062: svi kupci iz tabela (i oni bez duga), po tabeli/komercijalisti. */
export const receivableSheetCustomers = pgTable(
  "receivable_sheet_customers",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => receivableSnapshots.id, { onDelete: "restrict" }),
    rowNumber: integer("row_number").notNull(),
    sourceLabel: text("source_label").notNull(),
    customerLabel: text("customer_label").notNull(),
    labelKey: text("label_key").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.rowNumber] }),
    index("receivable_sheet_customers_label_idx").on(table.snapshotId, table.labelKey),
  ],
);

/** 0063: kreditni limit kupca koji je upisao vlasnik ili komercijalista (procenat ILI iznos). */
export const customerCreditLimits = pgTable("customer_credit_limits", {
  customerId: uuid("customer_id")
    .primaryKey()
    .references(() => customers.id, { onDelete: "restrict" }),
  percent: numeric("percent", { precision: 6, scale: 2 }),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  blockOrders: boolean("block_orders").notNull().default(false),
  note: text("note").notNull(),
  setBy: uuid("set_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
});
