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
import { sql } from "drizzle-orm";
import { syncDevices } from "./sync-devices";
import { users } from "./users";

/**
 * Vrsta komande — ZATVOREN skup.
 *
 * Jedan tip u P4. Enum, ne slobodan tekst: server ne sme da prosledi ništa što
 * bi uređaj protumačio kao program, putanju ili argument. Proširenje je
 * migracija, dakle svesna odluka.
 */
export const syncCommandType = pgEnum("sync_command_type", ["scan_and_sync"]);
export type SyncCommandType = (typeof syncCommandType.enumValues)[number];

/**
 * Stanja komande.
 *
 * `queued` i `delivered` su namerno razdvojeni — „portal je sačuvao zahtev“ i
 * „uređaj ga je preuzeo“ su različite tvrdnje.
 *
 * `completed_with_review` postoji da `completed` ne bi lagalo: ciklus u kome je
 * deo dokumenata otišao na ručni pregled jeste završen, ali NIJE knjižen.
 */
export const syncCommandStatus = pgEnum("sync_command_status", [
  "queued",
  "delivered",
  "running",
  "completed",
  "completed_with_review",
  "retry_pending",
  "failed",
  "blocked",
  "expired",
]);
export type SyncCommandStatus = (typeof syncCommandStatus.enumValues)[number];

/** Stanja iz kojih komanda više ne izlazi. */
export const TERMINALNA_STANJA: readonly SyncCommandStatus[] = [
  "completed",
  "completed_with_review",
  "failed",
  "blocked",
  "expired",
];

/** Stanja u kojima je komanda još „otvorena“ za uređaj. */
export const OTVORENA_STANJA: readonly SyncCommandStatus[] = [
  "queued",
  "delivered",
  "running",
  "retry_pending",
];

export const syncCommands = pgTable(
  "sync_commands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => syncDevices.id, { onDelete: "restrict" }),
    /**
     * Opseg se PREPISUJE sa uređaja pri kreiranju i zamrzava.
     *
     * Ne čita se iz zahteva: komanda pripada opsegu za koji je uređaj
     * registrovan.
     */
    sourceSystem: text("source_system").notNull(),
    issuerCode: text("issuer_code").notNull(),
    commandType: syncCommandType("command_type").notNull(),
    commandVersion: integer("command_version").notNull().default(1),
    /** Ko je zatražio; uređaj ga ne može promeniti. */
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: syncCommandStatus("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    /** Komandu koju uređaj ne preuzme do roka — ističe. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /**
     * Lease: koji uređaj drži komandu i do kada.
     *
     * Dva istovremena `poll`-a ne smeju dobiti istu komandu. Istek dozvoljava
     * ISTOM uređaju nastavak, ali ne pravi novu poslovnu komandu.
     */
    leaseOwnerDeviceId: uuid("lease_owner_device_id").references(() => syncDevices.id, {
      onDelete: "restrict",
    }),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** Ograničen enum razloga; nikad sirova poruka. */
    failureCode: text("failure_code"),
    /* --- Brojači: odvojeni, jer znače različite stvari. --- */
    foundCount: integer("found_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    postedCount: integer("posted_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    unsupportedCount: integer("unsupported_count").notNull().default(0),
    pendingCount: integer("pending_count").notNull().default(0),
    blockedCount: integer("blocked_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * Najviše JEDNA otvorena komanda po uređaju.
     *
     * Brava iza „dvostruki klik ne pravi dve komande“. Aplikativna provera ne
     * preživljava dva paralelna submit-a; delimičan jedinstveni indeks
     * preživljava.
     */
    uniqueIndex("sync_commands_one_open_per_device")
      .on(table.deviceId, table.commandType)
      .where(sql`status IN ('queued', 'delivered', 'running', 'retry_pending')`),
    index("sync_commands_device_status_idx").on(table.deviceId, table.status),
  ],
);

export type SyncCommandRow = typeof syncCommands.$inferSelect;

/**
 * Append-only trag napretka.
 *
 * Napredak je istorija, ne stanje koje se prepisuje. Bez okidača bi uređaj
 * mogao da „popravi“ raniji izveštaj i niko ne bi video da je izveštavao
 * drugačije.
 */
export const syncCommandEvents = pgTable(
  "sync_command_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    commandId: uuid("command_id")
      .notNull()
      .references(() => syncCommands.id, { onDelete: "restrict" }),
    /**
     * Stabilan ID koji pravi UREĐAJ.
     *
     * Isti `clientEventId` sa istim sadržajem je no-op (idempotentan ACK); sa
     * drugačijim sadržajem je konflikt — dva različita događaja ne mogu tvrditi
     * isti identitet.
     */
    clientEventId: text("client_event_id").notNull(),
    /** Server ga uzima IZ POTPISA, ne iz tela. */
    actorDeviceId: uuid("actor_device_id")
      .notNull()
      .references(() => syncDevices.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    status: syncCommandStatus("status").notNull(),
    failureCode: text("failure_code"),
    foundCount: integer("found_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    postedCount: integer("posted_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    unsupportedCount: integer("unsupported_count").notNull().default(0),
    pendingCount: integer("pending_count").notNull().default(0),
    blockedCount: integer("blocked_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sync_command_events_client_key").on(table.commandId, table.clientEventId),
    index("sync_command_events_command_idx").on(table.commandId, table.sequence),
  ],
);

export type SyncCommandEventRow = typeof syncCommandEvents.$inferSelect;
