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
    /**
     * Brojač koji obesmišljava sve ranije izdate tokene ovog korisnika.
     *
     * Odjava briše kolačić u tom pregledaču, ali ukraden JWT ostaje važeći do
     * isteka od osam sati — Auth.js ga ne poništava. Povećanjem ove vrednosti
     * svaka postojeća sesija pada pri sledećem zahtevu, jer se broj u tokenu
     * više ne poklapa sa brojem u bazi. Vidi `lib/authz/user-repository.ts`.
     */
    sessionVersion: integer("session_version").notNull().default(0),
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
