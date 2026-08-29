import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./permissions";
import { articles } from "./sales";
import { users } from "./users";

/* =========================================================================
 * Grupe kupaca
 * ====================================================================== */

/**
 * Grupa kupaca kao opseg pravila cene.
 *
 * Zasebna tabela, a ne kolona `customers.group`: kupac sme biti u više grupa
 * (npr. „veliki kupci" i „R-M program"), i kolona bi tu potrebu ućutkala time
 * što bi je učinila nemogućom.
 */
export const customerGroups = pgTable(
  "customer_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stabilan ključ za uvoz i izveštaje; naziv se sme menjati, ključ ne. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("customer_groups_key_key").on(table.key)],
);

export const customerGroupMembers = pgTable(
  "customer_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => customerGroups.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    addedBy: uuid("added_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.customerId] }),
    index("customer_group_members_customer_idx").on(table.customerId),
  ],
);

/* =========================================================================
 * Pravila cene
 * ====================================================================== */

export const priceCustomerScope = pgEnum("price_customer_scope", [
  "customer",
  "group",
  "all",
]);

export const priceProductScope = pgEnum("price_product_scope", [
  "article",
  "product_group",
  "brand",
  "all",
]);

/**
 * Pravilo daje ILI procenat rabata ILI fiksnu neto cenu — nikad oboje.
 *
 * Pravilo koje daje oboje nema jedan odgovor, pa bi svaki potrošač birao sam i
 * dva ekrana bi prikazala dve cene za isti artikal.
 */
export const priceValueKind = pgEnum("price_value_kind", [
  "discount_percent",
  "net_price",
]);

/**
 * Stanja pravila cene.
 *
 * `approved_pending_biznisoft` NIJE `confirmed`, i ta razlika je cela poenta
 * modela. Odobrenje je odluka gazde; potvrda je dokaz da je uslov stvarno
 * upisan u BizniSoft. Dok potvrde nema, pravilo NIJE garantovana fakturisana
 * cena. Vidi `docs/b2b/01-target-architecture.md`, AD-3.
 */
export const priceRuleStatus = pgEnum("price_rule_status", [
  "draft",
  "pending_approval",
  "approved_pending_biznisoft",
  /** Kancelarija evidentirala ručni unos u BizniSoft — NIJE dokaz sa fakture. */
  "office_recorded",
  "confirmed",
  "rejected",
  "reconciliation_failed",
  "revoked",
  "expired",
]);

export type PriceRuleStatus = (typeof priceRuleStatus.enumValues)[number];
export type PriceCustomerScope = (typeof priceCustomerScope.enumValues)[number];
export type PriceProductScope = (typeof priceProductScope.enumValues)[number];
export type PriceValueKind = (typeof priceValueKind.enumValues)[number];

export const priceRules = pgTable(
  "price_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /* --- opseg --- */
    customerScope: priceCustomerScope("customer_scope").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    customerGroupId: uuid("customer_group_id").references(
      () => customerGroups.id,
      { onDelete: "restrict" },
    ),
    productScope: priceProductScope("product_scope").notNull(),
    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "restrict",
    }),
    /** Naziv grupe tačno kako ga izvor vodi (`articles.product_group`). */
    productGroup: text("product_group"),
    /** Brend tačno kako ga izvor vodi (`articles.brand`). */
    brand: text("brand"),

    /**
     * Klasa prvenstva 1–12, izvedena iz para opsega i upisana.
     *
     * Upisuje se, a ne računa u upitu, iz dva razloga: da se po njoj može
     * indeksirati pri traženju sudara, i da bi u bazi ostalo zapisano po kojoj
     * je klasi pravilo odlučivalo u trenutku kada je nastalo.
     */
    precedenceLevel: integer("precedence_level").notNull(),
    /** `scopeKeyFor()` iz `lib/pricing/precedence.mjs`; osnova za pojam „isti opseg". */
    scopeKey: text("scope_key").notNull(),

    /* --- vrednost --- */
    valueKind: priceValueKind("value_kind").notNull(),
    discountPercent: numeric("discount_percent", { precision: 6, scale: 3 }),
    netPrice: numeric("net_price", { precision: 14, scale: 4 }),
    currency: text("currency").notNull().default("RSD"),

    /* --- važenje --- */
    effectiveFrom: date("effective_from").notNull(),
    /** `null` = bez roka. Granice su uključene na oba kraja. */
    effectiveTo: date("effective_to"),

    /* --- tok --- */
    status: priceRuleStatus("status").notNull().default("draft"),
    /** Obavezan obrazložen razlog predloga. */
    reason: text("reason").notNull(),
    proposedBy: uuid("proposed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    proposedAt: timestamp("proposed_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    /**
     * Ko je evidentirao da je uslov RUČNO upisan u BizniSoft.
     *
     * Ovo NIJE potvrda sa fakture — to je izjava čoveka iz kancelarije da je
     * upisao. Napomena je obavezna (`price_rules_office_recorded_ck`) jer je
     * jedini trag o tome ŠTA je tačno uneto.
     */
    officeRecordedBy: uuid("office_recorded_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    officeRecordedAt: timestamp("office_recorded_at", { withTimezone: true }),
    officeRecordNote: text("office_record_note"),

    /**
     * Dokaz sa fakture — popunjava ga isključivo budući read-only
     * reconciliation servis.
     *
     * `price_rules_confirmed_needs_invoice_ck` čini `confirmed` nemogućim bez
     * `reconciled_invoice_id`. Zabrana živi u bazi, ne u dobroj nameri
     * pozivaoca: nijedan UI, servis ni ručni SQL kroz aplikativnu rolu ne može
     * proglasiti pravilo potvrđenim bez reda iz `invoices`.
     *
     * Matching algoritam NIJE deo ove faze — ovo je samo mesto na koje se kači.
     */
    reconciledInvoiceId: uuid("reconciled_invoice_id"),
    reconciledInvoiceLineId: uuid("reconciled_invoice_line_id"),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    reconciliationNote: text("reconciliation_note"),

    confirmedBy: uuid("confirmed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmationNote: text("confirmation_note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("price_rules_customer_idx").on(table.customerId),
    index("price_rules_article_idx").on(table.articleId),
    index("price_rules_status_idx").on(table.status),
    // Traženje sudara je uvek „ista klasa, isti opseg" — indeks prati taj upit.
    index("price_rules_conflict_idx").on(
      table.precedenceLevel,
      table.scopeKey,
      table.status,
    ),
  ],
);

export type PriceRuleRow = typeof priceRules.$inferSelect;
