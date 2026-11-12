import { date, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { articles } from "./sales";
import { users } from "./users";

/** 0064: porudžbina dobavljaču — roba u dolasku sa rokom isporuke (raspon dana od dana porudžbine). */
export const supplierOrders = pgTable("supplier_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplier: text("supplier").notNull(),
  reference: text("reference"),
  orderedOn: date("ordered_on").notNull(),
  leadMinDays: integer("lead_min_days").notNull(),
  leadMaxDays: integer("lead_max_days").notNull(),
  source: text("source").notNull(),
  fileName: text("file_name"),
  note: text("note"),
  status: text("status").notNull().default("otvoreno"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedBy: uuid("closed_by").references(() => users.id, { onDelete: "restrict" }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

/** 0064: stavka porudžbine; `received` raste kada potvrđen lager pokaže povećanje stanja. */
export const supplierOrderLines = pgTable(
  "supplier_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => supplierOrders.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    supplierCode: text("supplier_code"),
    supplierName: text("supplier_name").notNull().default(""),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit"),
    received: numeric("received", { precision: 14, scale: 3 }).notNull().default("0"),
    baselineStock: numeric("baseline_stock", { precision: 14, scale: 3 }),
    lastSeenStock: numeric("last_seen_stock", { precision: 14, scale: 3 }),
    lastCheckedImportId: uuid("last_checked_import_id"),
    status: text("status").notNull().default("ceka"),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id, { onDelete: "restrict" }),
  },
  (t) => [unique("supplier_order_lines_no_unique").on(t.orderId, t.lineNo)],
);

/** 0064: zapamćena veza „dobavljač + njegova šifra → naš artikal“. */
export const supplierArticleCodes = pgTable(
  "supplier_article_codes",
  {
    supplier: text("supplier").notNull(),
    supplierCode: text("supplier_code").notNull(),
    articleId: uuid("article_id").notNull().references(() => articles.id, { onDelete: "restrict" }),
    confirmedBy: uuid("confirmed_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.supplier, t.supplierCode] })],
);
