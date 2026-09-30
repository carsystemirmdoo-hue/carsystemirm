import {
  bigserial,
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
  /** Zatražen pristup (predložio komercijalista ili kupac). Bez lozinke. */
  "requested",
  /**
   * Odobren i pozvan — poziv izdat, nalog JOŠ NEMA lozinku.
   *
   * Ne sme se prijaviti. Prijava postaje moguća tek pošto kupac sam postavi
   * lozinku kroz jednokratni pozivni token.
   */
  "approved",
  /** Kupac aktivirao nalog i postavio SVOJU lozinku. */
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
    /**
     * `null` sve dok kupac sam ne postavi lozinku kroz pozivni token.
     *
     * Kancelarija je NIKADA ne unosi i nikada ne saznaje. Baza to sprovodi:
     * `customer_users_password_lifecycle_ck` zabranjuje lozinku u stanjima
     * `requested`/`approved` i zahteva je u stanju `active`.
     */
    passwordHash: text("password_hash"),
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
    /** Cilj složenog ključa potvrde osobe (0028): potvrda pripada nalogu I firmi. */
    uniqueIndex("customer_users_id_customer_key").on(table.id, table.customerId),
    index("customer_users_customer_idx").on(table.customerId),
    index("customer_users_status_idx").on(table.status),
  ],
);

export type CustomerUserRow = typeof customerUsers.$inferSelect;

/* =========================================================================
 * Jednokratni tokeni kupčevog naloga
 * ====================================================================== */

export const customerTokenPurpose = pgEnum("customer_token_purpose", [
  "invitation",
  "password_reset",
]);

export type CustomerTokenPurpose =
  (typeof customerTokenPurpose.enumValues)[number];

/**
 * Poziv i reset lozinke — isti obrazac kao `mfa_enrollment_grants`.
 *
 * Čuva se ISKLJUČIVO HMAC otisak; sam token postoji jednom, u trenutku
 * izdavanja, i nigde se ne beleži — ni u logu, ni u auditu, ni u obaveštenju.
 *
 * Prethodni neiskorišćeni tokeni iste svrhe se poništavaju pri izdavanju novog:
 * u svakom trenutku sme da važi najviše jedan, pa zaboravljen stari ne ostaje
 * kao otvorena vrata.
 */
export const customerAccountTokens = pgTable(
  "customer_account_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => customerUsers.id, { onDelete: "cascade" }),
    purpose: customerTokenPurpose("purpose").notNull(),
    /** HMAC-SHA256 tokena. Sam token se ne čuva nigde. */
    tokenFingerprint: text("token_fingerprint").notNull(),
    keyVersion: integer("key_version").notNull(),
    /** Ko je izdao; `null` za samoposlužni reset koji je kupac sam pokrenuo. */
    issuedBy: uuid("issued_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_account_tokens_fingerprint_key").on(
      table.tokenFingerprint,
    ),
    index("customer_account_tokens_open_idx").on(
      table.customerUserId,
      table.purpose,
      table.usedAt,
    ),
  ],
);

export type CustomerAccountTokenRow =
  typeof customerAccountTokens.$inferSelect;

/* =========================================================================
 * Outbox — provider-neutralan ugovor za slanje
 * ====================================================================== */

export const outboxKind = pgEnum("customer_outbox_kind", [
  "invitation",
  "password_reset",
  "security_notice",
]);

export const outboxStatus = pgEnum("customer_outbox_status", [
  /** Čeka da ga neko isporuči. */
  "pending",
  /** Kancelarija je preuzela link i predaje ga van sistema. */
  "handed_over",
  /** Poslato kroz provajdera (kada provajder bude postojao). */
  "sent",
  "failed",
]);

/**
 * Šta treba poslati kupcu — bez ijednog tokena.
 *
 * Provajder e-pošte NE postoji i ne dodaje se (COST_CONTROL). Ovo je ugovor:
 * red se upisuje kada nastane razlog za poruku, a isporuku obavlja ili
 * kancelarija ručno (`handed_over`), ili budući provajder (`sent`).
 *
 * Token NAMERNO nije ovde. Da jeste, kopija ove tabele bi bila kopija svih
 * otvorenih poziva i resetâ. Kancelarija link vidi tačno jednom, u odgovoru
 * radnje koja ga je izdala.
 */
export const customerMessageOutbox = pgTable(
  "customer_message_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => customerUsers.id, { onDelete: "cascade" }),
    kind: outboxKind("kind").notNull(),
    status: outboxStatus("status").notNull().default("pending"),
    /** Kada je link predat čoveku; posle toga se više ne može prikazati. */
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    handedOverBy: uuid("handed_over_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("customer_message_outbox_status_idx").on(table.status, table.createdAt),
    index("customer_message_outbox_user_idx").on(table.customerUserId),
  ],
);

export type CustomerMessageOutboxRow =
  typeof customerMessageOutbox.$inferSelect;
