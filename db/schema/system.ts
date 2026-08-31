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
import { auditActorKind } from "./sync-devices";
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
    /*
     * `restrict`, ne `set null`.
     *
     * Nad ovom tabelom stoji okidač koji zabranjuje `UPDATE`. Sa `set null`
     * brisanje korisnika bi pokrenulo izmenu koju okidač odbija — pa bi model
     * protivrečio sam sebi, a poruka o grešci pokazivala na okidač umesto na
     * uzrok.
     *
     * Odluka je da se trag ne menja: korisnik koji u njemu figurira se NE briše.
     * Za prestanak rada postoje deaktivacija i reaktivacija.
     */
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    /**
     * Vrsta aktera (migracija 0024).
     *
     * Uređaj dobija STVARAN identitet, ne izmišljen `users` red. Lažan
     * korisnik bi se pojavio na svakom ekranu naloga i mogao bi da se
     * deaktivira ili mu se dodeli dozvola. CHECK u bazi brani nevažeću
     * kombinaciju: `user` traži `actor_user_id`, `device` traži
     * `actor_device_id` i zabranjuje korisnika, `system` ne dozvoljava nijedan.
     */
    actorKind: auditActorKind("actor_kind").notNull().default("user"),
    /**
     * Uređaj koji je izvršio radnju.
     *
     * NAMERNO bez stranog ključa. `CASCADE` bi pokušao da obriše trag, a
     * `SET NULL` je `UPDATE` nad njim — okidači `audit_log_no_delete` i
     * `audit_log_no_update` odbijaju oboje, pa bi brisanje uređaja pucalo sa
     * porukom o okidaču umesto o uzroku. Veza se čuva kao vrednost; jedini
     * upisivač je aplikacija, a red se nikad ne menja.
     */
    actorDeviceId: uuid("actor_device_id"),
    /** Ime i uloga u trenutku radnje — ostaje čitljivo i posle deaktivacije naloga. */
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
  // „Ko je promenio prag" ne sme da ispari brisanjem naloga — isti razlog kao
  // kod traga revizije.
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "restrict",
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
