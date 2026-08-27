import {
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Brojači pokušaja, u bazi umesto u memoriji.
 *
 * Serverless instance ne dele memoriju: `Map` u modulu bi značio da svaka nova
 * instanca počinje od nule, pa napadač dobija onoliko pokušaja koliko ima
 * instanci. Postgres je jedino zajedničko stanje koje već postoji.
 *
 * Ključ NIJE sirova IP adresa ni e-pošta. Čuva se HMAC izveden iz posebnog
 * ključa (`AUTH_RATE_LIMIT_HMAC_KEY`), pa kopija ove tabele ne otkriva ni ko se
 * prijavljivao ni odakle. Vidi `lib/auth/rate-limit-key.mjs`.
 */
export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Šta se ograničava: `password`, `totp`, `recovery`, `reset`. */
    scope: text("scope").notNull(),
    /** Po čemu se broji: `account` ili `ip`. */
    dimension: text("dimension").notNull(),
    /** HMAC identifikatora — nikad sirova vrednost. */
    subjectKey: text("subject_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    /** Početak tekućeg prozora; posle isteka brojač kreće iznova. */
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Do kada je pokušaj odbijen.
     *
     * Blokada je uvek privremena. Trajno zaključavanje bi značilo da napadač
     * može da isključi tuđi nalog time što namerno greši lozinku.
     */
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Jedan red po (opseg, dimenzija, subjekt) — osnova za atomski upsert.
    uniqueIndex("auth_rate_limits_key").on(
      table.scope,
      table.dimension,
      table.subjectKey,
    ),
    index("auth_rate_limits_window_idx").on(table.windowStartedAt),
  ],
);

/**
 * TOTP stanje jednog naloga.
 *
 * Tajna stoji isključivo šifrovana (AES-256-GCM). Odvojena tabela, a ne kolone u
 * `users`: tako se uobičajeni upiti nad korisnicima nikad ne dotiču šifrovanog
 * materijala, i lakše je ograničiti pristup.
 */
export const userMfa = pgTable(
  "user_mfa",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    /* --- aktivna tajna --- */
    /** `null` dok enrollment nije potvrđen prvim ispravnim kodom. */
    secretCiphertext: text("secret_ciphertext"),
    secretIv: text("secret_iv"),
    secretAuthTag: text("secret_auth_tag"),
    /** Verzija master ključa kojim je zapis šifrovan; osnova za rotaciju. */
    secretKeyVersion: integer("secret_key_version"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }),

    /**
     * Poslednji prihvaćeni TOTP prozor.
     *
     * Isti kod važi 30 sekundi; bez ovoga bi se presretnut kod mogao upotrebiti
     * drugi put unutar tog perioda. Uslov `> lastCounter` u `UPDATE`-u je i
     * brava protiv dve paralelne prijave istim kodom.
     */
    lastAcceptedCounter: integer("last_accepted_counter"),

    /* --- enrollment koji još nije potvrđen --- */
    pendingCiphertext: text("pending_ciphertext"),
    pendingIv: text("pending_iv"),
    pendingAuthTag: text("pending_auth_tag"),
    pendingKeyVersion: integer("pending_key_version"),
    /** Napuštena tajna ne sme da važi zauvek. */
    pendingExpiresAt: timestamp("pending_expires_at", { withTimezone: true }),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/**
 * Jednokratni recovery kodovi.
 *
 * Čuva se samo HMAC otisak. Kodovi su visokoentropijski slučajni tokeni, pa im
 * ne treba spora funkcija za izvođenje ključa — treba im tajni ključ, da kopija
 * baze ne omogući predračunavanje.
 */
export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** HMAC-SHA256 normalizovanog koda. Sam kod se ne čuva nigde. */
    codeFingerprint: text("code_fingerprint").notNull(),
    keyVersion: integer("key_version").notNull(),
    /** Redni broj seta; regeneracija poništava ceo prethodni set. */
    batch: integer("batch").notNull().default(1),
    /** Popunjeno atomski pri upotrebi; `null` znači neiskorišćen. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mfa_recovery_codes_fingerprint_key").on(
      table.userId,
      table.codeFingerprint,
    ),
    index("mfa_recovery_codes_user_idx").on(table.userId, table.usedAt),
  ],
);

/**
 * Jednokratni kod za administratorski reset lozinke.
 *
 * Nema slanja e-pošte u ovoj fazi: vlasnik kod pročita jednom sa ekrana i preda
 * ga korisniku van sistema. Zato kod NIKADA ne ide u adresu — samo u obrazac.
 */
export const passwordResetCodes = pgTable(
  "password_reset_codes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeFingerprint: text("code_fingerprint").notNull(),
    keyVersion: integer("key_version").notNull(),
    issuedBy: uuid("issued_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** Popunjeno kada nov kod poništi ovaj. */
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("password_reset_codes_user_idx").on(table.userId, table.usedAt),
    uniqueIndex("password_reset_codes_fingerprint_key").on(table.codeFingerprint),
  ],
);

/**
 * Jednokratna dozvola za vezivanje drugog faktora.
 *
 * Bez nje bi napadač koji je došao do lozinke mogao **prvi** da veže svoj
 * authenticator na tuđ nalog i time trajno preuzme pristup — lozinka bi mu
 * otvorila vrata, a MFA bi ih zaključao za pravog vlasnika.
 *
 * Zato vezivanje traži i nešto što napadač nema: kod koji vlasnik izdaje van
 * sistema. Prvi vlasnik ga dobija kroz `scripts/issue-mfa-enrollment-grant.mjs`.
 */
export const mfaEnrollmentGrants = pgTable(
  "mfa_enrollment_grants",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** HMAC otisak; sam kod ne postoji nigde posle prikaza. */
    codeFingerprint: text("code_fingerprint").notNull(),
    keyVersion: integer("key_version").notNull(),
    /** `null` za bootstrap iz komandne linije. */
    issuedBy: uuid("issued_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** Popunjeno kada nov grant poništi ovaj. */
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mfa_enrollment_grants_fingerprint_key").on(table.codeFingerprint),
    index("mfa_enrollment_grants_user_idx").on(table.userId, table.usedAt),
  ],
);
