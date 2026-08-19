import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Osnovne uloge iz specifikacije. Uloga „Menadžer" ne postoji i ne sme se dodavati —
 * dublji pristup se dodeljuje isključivo kroz pakete dozvola (vidi permissions.ts).
 */
export const userRole = pgEnum("user_role", [
  "gazda",
  "komercijalista",
  "kancelarija",
  "magacioner",
]);

export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Uvek se čuva u malim slovima; prijava normalizuje unos. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    active: boolean("active").notNull().default(true),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

export type UserRow = typeof users.$inferSelect;
