import {
  bigserial,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customerUsers } from "./customer-accounts";
import { users } from "./users";

/**
 * Za šta se traži saglasnost.
 *
 * Dve ODVOJENE odluke, namerno. E-pošta i oglasna publika nisu isto: kupac sme
 * da pristane da prima obaveštenja, a da ne pristane da njegovi podaci uđu u
 * publiku oglasne platforme. Jedan checkbox za oboje bi tu razliku ukinuo.
 */
export const consentPurpose = pgEnum("consent_purpose", [
  "email_marketing",
  "ad_personalization",
]);

export const consentAction = pgEnum("consent_action", ["granted", "withdrawn"]);

/**
 * Odakle je odluka stigla.
 *
 * `office_recorded_offline` postoji za zakonito evidentiranje pristanka datog
 * van sistema (npr. potpisan formular). Takav zapis MORA imati `recorded_by`,
 * jer iza njega stoji čovek koji tvrdi da je pristanak dat.
 */
export const consentSource = pgEnum("consent_source", [
  "customer_self_service",
  "office_recorded_offline",
]);

export type ConsentPurpose = (typeof consentPurpose.enumValues)[number];
export type ConsentAction = (typeof consentAction.enumValues)[number];

/**
 * Append-only istorija saglasnosti kupca.
 *
 * Povlačenje NE briše raniji pristanak — dodaje nov događaj. Trenutno stanje se
 * izvodi iz poslednjeg događaja po (nalog, svrha). Brisanje bi značilo da se
 * kasnije ne može dokazati ni da je pristanak ikad postojao, ni kada je
 * povučen — a upravo to je ono što pravni pregled traži.
 *
 * Tabela NE čuva ništa osim odluke: bez adrese, bez PIB-a, bez sadržaja
 * poruka. Sve što treba je „ko, za šta, kada, po kojoj verziji teksta".
 */
export const customerContactConsents = pgTable(
  "customer_contact_consents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => customerUsers.id, { onDelete: "restrict" }),
    purpose: consentPurpose("purpose").notNull(),
    action: consentAction("action").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: consentSource("source").notNull(),
    /** Verzija teksta saglasnosti; osnova za kasniji pravni pregled. */
    consentTextVersion: text("consent_text_version").notNull(),
    /** Obavezno kada je pristanak evidentiran van sistema. */
    recordedBy: uuid("recorded_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
  },
  (table) => [
    index("customer_contact_consents_current_idx").on(
      table.customerUserId,
      table.purpose,
      table.id,
    ),
  ],
);

export type CustomerContactConsentRow =
  typeof customerContactConsents.$inferSelect;
