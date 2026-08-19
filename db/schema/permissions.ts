import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Paketi dozvola su podaci, a ne kod — Gazda ih dodeljuje pojedinačnim korisnicima
 * nezavisno od osnovne uloge. Miroslav Suljagić je Komercijalista sa paketom
 * „analitika"; nigde ne postoji provera po imenu korisnika.
 */
export const permissionPackages = pgTable("permission_packages", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  sortOrder: text("sort_order").notNull().default("0"),
});

export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissionPackages.key, { onDelete: "restrict" }),
    grantedBy: uuid("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text("reason"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.permissionKey] }),
    index("user_permissions_user_idx").on(table.userId),
  ],
);

/**
 * Minimalni model kupca. Faze 2+ ga proširuju uvezenim podacima iz BiznisSoft izvoza;
 * identitet je PIB, pa ponovni uvoz ne pravi duplikate.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pib: text("pib").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // PIB je poslovni identitet kupca — jedinstvenost je uslov da ponovni uvoz
  // istog BiznisSoft fajla ne napravi drugog kupca (faza 2).
  (table) => [uniqueIndex("customers_pib_key").on(table.pib)],
);

/** Komercijalista vidi isključivo kupce koji su mu dodeljeni ovde. */
export const customerAssignments = pgTable(
  "customer_assignments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.customerId] }),
    index("customer_assignments_customer_idx").on(table.customerId),
  ],
);
