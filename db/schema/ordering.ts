import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customerUsers } from "./customer-accounts";
import { customers } from "./permissions";
import { priceProductScope } from "./pricing";
import { articles } from "./sales";
import { users } from "./users";

/*
 * Kupčevo poručivanje (migracija 0029). Vidi `docs/b2b/25-f7-ordering-preparation.md`.
 *
 * Istorijske fakturisane cene (`invoice_lines`) NISU izvor važeće cene. Važeća
 * cena postoji samo u aktivnom cenovniku.
 */

export const priceListKind = pgEnum("price_list_kind", ["demo", "biznisoft"]);
export const priceListStatus = pgEnum("price_list_status", ["draft", "active", "retired"]);
export const customerOrderStatus = pgEnum("customer_order_status", [
  "submitted",
  "under_review",
  "changes_requested",
  "confirmed",
  "rejected",
  "cancelled",
  // 0030: vraćen kupcu na ispravku; ostaje u istoriji, zamenjuje ga nov zahtev.
  "superseded",
  // 0044: izmenjen predlog kancelarije čeka potvrdu kupca.
  "awaiting_customer",
]);
export const priceRequestStatus = pgEnum("price_request_status", ["open", "in_progress", "answered", "closed"]);
/** 0049: `procurement` = upit za nabavku (proizvod koji trenutno ne prodajemo direktno). */
export const priceRequestKind = pgEnum("price_request_kind", ["no_price", "special_terms", "procurement"]);

export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: priceListKind("kind").notNull(),
    status: priceListStatus("status").notNull().default("draft"),
    currency: text("currency").notNull().default("RSD"),
    validFrom: date("valid_from").notNull(),
    sourceNote: text("source_note").notNull(),
    activatedBy: uuid("activated_by").references(() => users.id, { onDelete: "restrict" }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("price_lists_code_key").on(table.code)],
);

export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    unit: text("unit").notNull(),
    packLabel: text("pack_label").notNull(),
    netPrice: numeric("net_price", { precision: 14, scale: 4 }).notNull(),
    vatPercent: numeric("vat_percent", { precision: 5, scale: 2 }).notNull(),
    minQuantity: numeric("min_quantity", { precision: 14, scale: 3 }).notNull().default("1"),
    quantityStep: numeric("quantity_step", { precision: 14, scale: 3 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("price_list_items_article_key").on(table.priceListId, table.articleId)],
);

export const priceListCustomerTerms = pgTable(
  "price_list_customer_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    productScope: priceProductScope("product_scope").notNull(),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    productGroup: text("product_group"),
    brand: text("brand"),
    discountPercent: numeric("discount_percent", { precision: 6, scale: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("price_list_customer_terms_customer_idx").on(table.priceListId, table.customerId)],
);

export const customerCartItems = pgTable(
  "customer_cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => customerUsers.id, { onDelete: "restrict" }),
    /** 0030: stavka vraćena iz zahteva na ispravku. */
    sourceOrderId: uuid("source_order_id"),
    /** 0047: broj celih pakovanja koje je kupac izabrao; `quantity` = broj × potvrđeno pakovanje. */
    packCount: integer("pack_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("customer_cart_items_key").on(table.customerId, table.articleId)],
);

export const customerOrders = pgTable(
  "customer_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** 0044: kupac koji je poslao; izmenjen predlog kancelarije ga nema (vidi preparedBy). */
    submittedBy: uuid("submitted_by").references(() => customerUsers.id, { onDelete: "restrict" }),
    requestNumber: text("request_number").notNull(),
    orderNumber: text("order_number"),
    status: customerOrderStatus("status").notNull().default("submitted"),
    idempotencyKey: text("idempotency_key").notNull(),
    priceListId: uuid("price_list_id").references(() => priceLists.id, { onDelete: "restrict" }),
    priceListKind: priceListKind("price_list_kind"),
    /** 0044: 'demo' (demo cenovnik) ili 'cenovnik' (osnovne cene + odobreni rabati). */
    pricingSource: text("pricing_source").notNull().default("demo"),
    /** 0044: izabrana odobrena opcija plaćanja (šifra i naziv pri slanju). Nije dokaz uplate. */
    paymentOption: text("payment_option"),
    paymentOptionLabel: text("payment_option_label"),
    revision: integer("revision").notNull().default(1),
    deliveryAddress: text("delivery_address"),
    contactPhone: text("contact_phone"),
    preparedBy: uuid("prepared_by").references(() => users.id, { onDelete: "restrict" }),
    onRequestLines: integer("on_request_lines").notNull().default(0),
    currency: text("currency").notNull(),
    netTotal: numeric("net_total", { precision: 14, scale: 2 }).notNull(),
    vatTotal: numeric("vat_total", { precision: 14, scale: 2 }).notNull(),
    grossTotal: numeric("gross_total", { precision: 14, scale: 2 }).notNull(),
    customerNote: text("customer_note"),
    statusReason: text("status_reason"),
    /** 0030: ovaj zahtev je ispravka navedenog. */
    replacesOrderId: uuid("replaces_order_id"),
    biznisoftDocumentNumber: text("biznisoft_document_number"),
    biznisoftRecordedBy: uuid("biznisoft_recorded_by").references(() => users.id, { onDelete: "restrict" }),
    biznisoftRecordedAt: timestamp("biznisoft_recorded_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "restrict" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "restrict" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_orders_idempotency_key").on(table.idempotencyKey),
    uniqueIndex("customer_orders_request_number_key").on(table.requestNumber),
    uniqueIndex("customer_orders_order_number_key").on(table.orderNumber),
    index("customer_orders_customer_idx").on(table.customerId, table.submittedAt),
    index("customer_orders_status_idx").on(table.status),
  ],
);

export const customerOrderLines = pgTable(
  "customer_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => customerOrders.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    articleCode: text("article_code").notNull(),
    articleName: text("article_name").notNull(),
    catalogProductSlug: text("catalog_product_slug"),
    catalogVariantId: text("catalog_variant_id"),
    catalogName: text("catalog_name"),
    unit: text("unit").notNull(),
    packLabel: text("pack_label").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    listPrice: numeric("list_price", { precision: 14, scale: 4 }),
    discountPercent: numeric("discount_percent", { precision: 6, scale: 3 }).default("0"),
    netPrice: numeric("net_price", { precision: 14, scale: 4 }),
    vatPercent: numeric("vat_percent", { precision: 5, scale: 2 }),
    lineNet: numeric("line_net", { precision: 14, scale: 2 }),
    lineVat: numeric("line_vat", { precision: 14, scale: 2 }),
    lineGross: numeric("line_gross", { precision: 14, scale: 2 }),
    priceBasis: text("price_basis").notNull(),
    /** 0044: 'cena' ili 'na_upit' (bez potvrđene cene za izabranu opciju — bez iznosa). */
    priceStatus: text("price_status").notNull().default("cena"),
    onRequestReason: text("on_request_reason"),
    packConfirmed: boolean("pack_confirmed").notNull().default(false),
    /** 0047: broj pakovanja koje je kupac poručio i količina jednog pakovanja u JM. */
    packCount: integer("pack_count"),
    packQuantity: numeric("pack_quantity", { precision: 14, scale: 3 }),
  },
  (table) => [uniqueIndex("customer_order_lines_key").on(table.orderId, table.lineNumber)],
);

/**
 * 0047: potvrđena količina JEDNOG pakovanja u BizniSoft JM artikla (npr. LIT 5).
 * Bez potvrde artikal sa mernom JM se ne poručuje u pakovanjima (mera iz naziva nije potvrda).
 */
export const articlePackSizes = pgTable("article_pack_sizes", {
  articleId: uuid("article_id")
    .primaryKey()
    .references(() => articles.id, { onDelete: "restrict" }),
  packQuantity: numeric("pack_quantity", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  label: text("label").notNull(),
  evidence: text("evidence").notNull(),
  confirmedBy: uuid("confirmed_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  /** Izričit izuzetak: pakovanje je deo jednog KOM (npr. paket 125 = 0,5 KOM stare kutije od 250). */
  fractionalOk: boolean("fractional_ok").notNull().default(false),
});

/**
 * 0048: potvrđen pribor koji se prodaje odvojeno (posuda → poklopac, lak → herter iz tehničkog
 * lista). Sajt ga samo predlaže, nikad ne dodaje sam; stanje zaliha se ne čuva (izvor ne postoji).
 */
export const articleCompanions = pgTable("article_companions", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "restrict" }),
  companionArticleId: uuid("companion_article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  evidence: text("evidence").notNull(),
  confirmedBy: uuid("confirmed_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
  optionLabel: text("option_label"),
  sourceUrl: text("source_url"),
  ratioBase: numeric("ratio_base", { precision: 8, scale: 3 }),
  ratioCompanion: numeric("ratio_companion", { precision: 8, scale: 3 }),
  /** `zapremina` | `masa` | null (izvor ne navodi osnovu → bez predloga količine). */
  ratioBasis: text("ratio_basis"),
});

/**
 * 0056: obavezan par u jednakoj količini (blanko posuda → poklopac). Za razliku od pribora gore,
 * server ga sprovodi: korpa usklađuje poklopac sa posudama, a slanje se odbija ako par nije jednak.
 */
export const articleRequiredPairs = pgTable("article_required_pairs", {
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "restrict" }),
  companionArticleId: uuid("companion_article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "restrict" }),
  evidence: text("evidence").notNull(),
  decidedBy: uuid("decided_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
});

export const customerOrderEvents = pgTable(
  "customer_order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => customerOrders.id, { onDelete: "restrict" }),
    fromStatus: customerOrderStatus("from_status"),
    toStatus: customerOrderStatus("to_status"),
    kind: text("kind").notNull(),
    actorCustomerUserId: uuid("actor_customer_user_id").references(() => customerUsers.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    actorName: text("actor_name").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("customer_order_events_order_idx").on(table.orderId, table.createdAt)],
);

export const customerPriceRequests = pgTable(
  "customer_price_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by").notNull().references(() => customerUsers.id, { onDelete: "restrict" }),
    requestNumber: text("request_number").notNull(),
    kind: priceRequestKind("kind").notNull(),
    status: priceRequestStatus("status").notNull().default("open"),
    idempotencyKey: text("idempotency_key").notNull(),
    catalogProductSlug: text("catalog_product_slug").notNull(),
    catalogVariantId: text("catalog_variant_id"),
    catalogName: text("catalog_name").notNull(),
    variantLabel: text("variant_label"),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    customerNote: text("customer_note"),
    answer: text("answer"),
    handledBy: uuid("handled_by").references(() => users.id, { onDelete: "restrict" }),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_price_requests_idempotency_key").on(table.idempotencyKey),
    uniqueIndex("customer_price_requests_number_key").on(table.requestNumber),
    index("customer_price_requests_customer_idx").on(table.customerId, table.createdAt),
    index("customer_price_requests_status_idx").on(table.status),
  ],
);

/**
 * 0049: odluka da se artikal nudi samo kroz upit za nabavku (ne dodaje se u korpu).
 * Zapisi se samo dodaju; važi poslednji po artiklu (`articles_procurement_only`).
 */
export const articleOfferDecisions = pgTable("article_offer_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "restrict" }),
  procurementOnly: boolean("procurement_only").notNull(),
  reason: text("reason").notNull(),
  sourceBatch: text("source_batch"),
  decidedBy: uuid("decided_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});
