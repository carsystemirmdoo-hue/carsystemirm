import {
  index,
  integer,
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
 * Stanje kupčevog naloga.
 *
 * Namerno NIJE `active boolean` kao kod internih naloga. Kupčev nalog prolazi
 * kroz odobrenje pre nego što uopšte sme da postoji kao pristup, a „zatraženo"
 * i „odbijeno" su stanja koja boolean ne ume da razlikuje od „isključeno".
 */
export const customerAccountStatus = pgEnum("customer_account_status", [
  /** Zatražen pristup; još nema odluke. Ne sme se prijaviti. */
  "requested",
  /** Odobren, nalog otvoren, još se nijednom nije prijavio. */
  "approved",
  /** Odobren i bar jednom prijavljen. */
  "active",
  /** Privremeno isključen odlukom kancelarije ili gazde. */
  "suspended",
  /** Odbijen uz obavezan razlog. Ne sme se prijaviti. */
  "rejected",
]);

export type CustomerAccountStatus =
  (typeof customerAccountStatus.enumValues)[number];

/**
 * Nalog kupca — ODVOJEN identitet, ne peta vrednost u `users.role`.
 *
 * Zašto odvojena tabela (AD-2, `docs/b2b/01-target-architecture.md`)
 * ------------------------------------------------------------------
 * `resolveCapabilities(role, packages)` vraća skup sposobnosti koji ne poznaje
 * pojam „čiji". `view:kupci` znači „sme da vidi ekran kupaca", ne „sme da vidi
 * SVOG kupca". Dodavanje `kupac` u taj enum značilo bi da svaka postojeća
 * provera oblika `can(user, "…")` mora dodatno pitati „a koji kupac?" — i da
 * jedna zaboravljena dopuna curi cene konkurentu.
 *
 * Ovako je izolacija strukturna: nalog FIZIČKI nosi svoj `customer_id`, i ne
 * postoji putanja u kojoj se taj podatak uzima odnekud drugde.
 */
export const customerUsers = pgTable(
  "customer_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Tačno jedan kupac po nalogu. Jedna firma sme imati VIŠE naloga
     * (vlasnik + nabavka) — što je 1:N u ovom smeru — ali jedan nalog nikada
     * ne pokriva dve firme.
     *
     * `restrict`: brisanje kupca ne sme tiho ostaviti nalog bez vlasnika.
     */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** Uvek u malim slovima; prijava normalizuje unos. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: customerAccountStatus("status").notNull().default("requested"),
    /** Isti mehanizam opoziva kao kod internih naloga (`users.session_version`). */
    sessionVersion: integer("session_version").notNull().default(0),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Ko je iz firme odobrio ili odbio; `restrict` iz istog razloga kao u auditu. */
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Obavezan pri odbijanju i isključenju. */
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /*
     * E-pošta je jedinstvena PREKO CELE TABELE, ne po kupcu.
     *
     * Po kupcu bi značilo da ista adresa može imati nalog kod dve firme — a
     * prijava zna samo adresu, pa bi morala da bira. Sistem koji bira između
     * dva naloga na osnovu adrese je sistem koji povremeno izabere pogrešan.
     */
    uniqueIndex("customer_users_email_key").on(table.email),
    index("customer_users_customer_idx").on(table.customerId),
    index("customer_users_status_idx").on(table.status),
  ],
);

export type CustomerUserRow = typeof customerUsers.$inferSelect;
