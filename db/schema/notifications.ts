import {
  bigserial,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Vrste obaveštenja koja sistem stvarno proizvodi.
 *
 * Zatvoren spisak, ne slobodan tekst: obaveštenje čiju vrstu niko ne poznaje
 * ne može se ni filtrirati ni prebrojati, pa se u praksi ne čita.
 */
export const notificationKind = pgEnum("notification_kind", [
  "price_rule_proposed",
  "price_rule_approved",
  "price_rule_rejected",
  "price_rule_conflict",
  "price_rule_reconciliation_failed",
  "price_rule_revoked",
  /** Mapiranje koje menja ono što kupac vidi. */
  "mapping_customer_facing_changed",
  "external_identity_conflict",
  "customer_account_status_changed",
]);

export const notificationSeverity = pgEnum("notification_severity", [
  "info",
  "warning",
  "critical",
]);

export const notificationStatus = pgEnum("notification_status", [
  "unread",
  "read",
  "resolved",
]);

export type NotificationKind = (typeof notificationKind.enumValues)[number];
export type NotificationSeverity =
  (typeof notificationSeverity.enumValues)[number];
export type NotificationStatus = (typeof notificationStatus.enumValues)[number];

/**
 * Obaveštenja za gazdu i kancelariju.
 *
 * Ko ga vidi određuje SPOSOBNOST, ne uloga (`required_capability`). Uloga bi
 * značila da se pri svakom novom paketu dozvola mora obići i ova tabela; ovako
 * se obaveštenje vezuje za isto pravilo kao i ekran na koji vodi.
 *
 * Tabela NIJE audit i ne zamenjuje ga. Obaveštenje se čita i zatvara;
 * `audit_log` se ne menja ni brisati. Zato ovde stoji samo referenca na entitet,
 * a ne kopija vrednosti pre i posle.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: notificationKind("kind").notNull(),
    severity: notificationSeverity("severity").notNull().default("info"),
    status: notificationStatus("status").notNull().default("unread"),
    /** Sposobnost koju korisnik mora imati da bi ovo video. */
    requiredCapability: text("required_capability").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** Ruta portala na kojoj se radnja završava. */
    actionHref: text("action_href"),
    /**
     * Dodatni kontekst za prikaz.
     *
     * NIKAD osetljive vrednosti: bez PIB-a, adrese, tokena i lozinki. Isti
     * razlog kao kod `audit_log` — obaveštenja se čitaju na više mesta i
     * najlakše iscure.
     */
    context: jsonb("context"),
    /** Povezuje obaveštenje sa audit zapisom iste radnje. */
    correlationId: text("correlation_id"),
    /**
     * Ključ istovetnosti, za idempotentno slanje.
     *
     * Dok je obaveštenje otvoreno, isti ključ ne pravi nov red — mutacija koja
     * ponovo primeti isti uslov ne puni listu. Kada se zatvori, ponovna pojava
     * je nov događaj i sme da napravi nov red; vidi migraciju 0015.
     */
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    readBy: uuid("read_by").references(() => users.id, { onDelete: "restrict" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    resolutionNote: text("resolution_note"),
  },
  (table) => [
    index("notifications_status_idx").on(table.status, table.createdAt),
    index("notifications_capability_idx").on(table.requiredCapability),
    index("notifications_entity_idx").on(table.entityType, table.entityId),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
