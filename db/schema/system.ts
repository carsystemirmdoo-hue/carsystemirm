import {
  bigserial,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Trag revizije je „append-only": aplikacija nema nijednu putanju koja menja ili briše red.
 * Na nivou baze se to dodatno osigurava oduzimanjem prava aplikativnoj ulozi —
 * vidi db/migrations/0001_audit_log_append_only.sql.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Ime i uloga u trenutku radnje — ostaje čitljivo i ako korisnik kasnije bude obrisan. */
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    entityLabel: text("entity_label"),
    valueBefore: jsonb("value_before"),
    valueAfter: jsonb("value_after"),
    reason: text("reason"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_idx").on(table.createdAt),
    index("audit_log_actor_idx").on(table.actorUserId),
  ],
);

/** Sistemski pragovi i konfiguracija (npr. pragovi upozorenja 70/90/100). */
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Podešavanja interfejsa vezana za nalog (npr. skupljena/proširena navigacija). */
export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);
