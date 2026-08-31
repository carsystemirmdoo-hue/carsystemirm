import {
  bigserial,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/* =========================================================================
 * Poreklo podataka
 * ====================================================================== */

/**
 * Odakle je dokument stigao.
 *
 * `legacy_unknown` je IZRIČITO stanje, ne rezerva za lenjost: red nastao pre
 * uvođenja ove kolone ne zna se odakle je došao, a ime fajla to ne dokazuje.
 * `canonical:<hash>` u `file_name` je prikazna oznaka, ne poreklo.
 */
export const documentOrigin = pgEnum("document_origin", [
  "manual_upload",
  "device",
  "csv_import",
  "legacy_unknown",
]);

export type DocumentOrigin = (typeof documentOrigin.enumValues)[number];

/**
 * Odakle jedna VREDNOST dolazi.
 *
 * Postoji zbog valute. „RSD pročitan sa dokumenta“ i „RSD podrazumevan
 * konfiguracijom izvora“ su različite tvrdnje, a razlika se vidi tek kada se
 * pojavi dokument u drugoj valuti. Bez ove kolone bi usaglašavanje cena moglo
 * da nepoznatu valutu pretvori u „RSD dokaz“.
 */
export const valueProvenance = pgEnum("value_provenance", [
  "document",
  "source_default",
  "legacy_unknown",
]);

export type ValueProvenance = (typeof valueProvenance.enumValues)[number];

/* =========================================================================
 * Uređaji
 * ====================================================================== */

/**
 * Stanje uređaja ili njegovog ključa.
 *
 * Registracija NIKADA ne daje `active`. Aktivacija je zaseban čin čoveka sa
 * `devices:manage` — inače bi svako ko ume da sastavi zahtev za registraciju
 * time i otvorio kanal ka prometu.
 */
export const syncDeviceStatus = pgEnum("sync_device_status", [
  "registered",
  "active",
  "suspended",
  "revoked",
]);

export type SyncDeviceStatus = (typeof syncDeviceStatus.enumValues)[number];

/**
 * Registrovan uređaj.
 *
 * `sourceSystem` i `issuerCode` su JEDINI izvor opsega pri prijemu. Payload
 * nosi svoj `issuer.code`, ali se on samo poredi sa ovim redom — sadržaj koji
 * sam sebi dodeli opseg nije opseg.
 */
export const syncDevices = pgTable(
  "sync_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stabilna oznaka koju uređaj šalje u zaglavlju. */
    deviceCode: text("device_code").notNull(),
    label: text("label").notNull(),
    sourceSystem: text("source_system").notNull(),
    issuerCode: text("issuer_code").notNull(),
    status: syncDeviceStatus("status").notNull().default("registered"),
    registeredBy: uuid("registered_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    activatedBy: uuid("activated_by").references(() => users.id, { onDelete: "restrict" }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "restrict" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    /**
     * Poslednji AUTENTIFIKOVAN kontakt.
     *
     * Pomera ga isključivo zahtev sa proverenim potpisom. Nepotpisan ili
     * odbijen heartbeat ga ne dira — inače bi „uređaj se javio“ značilo samo
     * „neko je pogodio adresu“.
     */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sync_devices_code_key").on(table.deviceCode),
    index("sync_devices_scope_idx").on(table.sourceSystem, table.issuerCode),
  ],
);

export type SyncDeviceRow = typeof syncDevices.$inferSelect;

/**
 * Verzionisani JAVNI ključevi uređaja.
 *
 * Server čuva isključivo javni deo. Privatni ključ nastaje na uređaju i ovde
 * nema kolonu u koju bi mogao da stane — to je namerno, ne previd.
 */
export const syncDeviceKeys = pgTable(
  "sync_device_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => syncDevices.id, { onDelete: "restrict" }),
    /** Oznaka koju uređaj šalje uz potpis. */
    keyId: text("key_id").notNull(),
    /** Jedini podržan profil u v1; kolona postoji da bi rotacija bila moguća. */
    algorithm: text("algorithm").notNull().default("ed25519"),
    /** SPKI DER u base64. */
    publicKeySpki: text("public_key_spki").notNull(),
    /** SHA-256 nad SPKI DER bajtovima — za ljudsku proveru pri aktivaciji. */
    fingerprint: text("fingerprint").notNull(),
    status: syncDeviceStatus("status").notNull().default("registered"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    activatedBy: uuid("activated_by").references(() => users.id, { onDelete: "restrict" }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "restrict" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
  },
  (table) => [
    /*
     * `key_id` je jedinstven po uređaju i kada je ključ opozvan.
     *
     * Ponovna upotreba opozvane oznake bi značila da potpis star godinu dana
     * pokazuje na nov ključ — istorija bi postala neproverljiva.
     */
    uniqueIndex("sync_device_keys_key_id_key").on(table.deviceId, table.keyId),
    /** Isti javni ključ ne sme pripadati dvama uređajima. */
    uniqueIndex("sync_device_keys_fingerprint_key").on(table.fingerprint),
  ],
);

export type SyncDeviceKeyRow = typeof syncDeviceKeys.$inferSelect;

/* =========================================================================
 * Anti-replay
 * ====================================================================== */

/**
 * Viđeni nonce-ovi.
 *
 * U BAZI, ne u memoriji: `Set` u modulu ne preživljava restart procesa i ne
 * dele ga dve instance, pa bi napadaču dao onoliko ponavljanja koliko ima
 * instanci — i sve bi izgledalo ispravno.
 *
 * Jedinstvenost `(deviceId, keyId, nonce)` je ta koja odlučuje: dva istovremena
 * zahteva sa istim nonce-om oba prođu proveru potpisa, ali `INSERT` propušta
 * tačno jedan.
 */
export const syncRequestNonces = pgTable(
  "sync_request_nonces",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => syncDevices.id, { onDelete: "restrict" }),
    keyId: text("key_id").notNull(),
    nonce: text("nonce").notNull(),
    /** Timestamp iz potpisanog zahteva. */
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Do kada red MORA da se čuva.
     *
     * Računa se od `signedAt`, ne od trenutka upisa: zahtev čiji je timestamp
     * još u dozvoljenom prozoru mogao bi da prođe drugi put ako se red obriše
     * ranije. Rok je prozor plus rezerva.
     */
    retainUntil: timestamp("retain_until", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("sync_request_nonces_key").on(table.deviceId, table.keyId, table.nonce),
    index("sync_request_nonces_retain_idx").on(table.retainUntil),
  ],
);

export type SyncRequestNonceRow = typeof syncRequestNonces.$inferSelect;

/* =========================================================================
 * Akter u tragu revizije
 * ====================================================================== */

/**
 * Vrsta aktera.
 *
 * Uređaj dobija stvaran identitet umesto izmišljenog `users` reda. Lažan
 * korisnik bi se pojavio na svakom ekranu naloga i mogao bi da se deaktivira,
 * resetuje mu lozinka ili dodeli dozvola. Korisnik koji je uređaj registrovao
 * takođe nije akter njegovih budućih uvoza — on je odobrio kanal, nije uneo
 * dokument.
 */
export const auditActorKind = pgEnum("audit_actor_kind", ["user", "device", "system"]);

export type AuditActorKind = (typeof auditActorKind.enumValues)[number];
