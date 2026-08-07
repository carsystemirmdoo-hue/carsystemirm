export type UserRole = "owner" | "sales" | "office";

export type Permission =
  | "dashboard:company"
  | "dashboard:sales"
  | "dashboard:operations"
  | "orders:view_all"
  | "orders:view_own"
  | "orders:create"
  | "orders:process"
  | "customers:view_all"
  | "customers:view_own"
  | "customers:edit_own"
  | "customers:view_financials"
  | "customers:view_confidential"
  | "prices:view"
  | "prices:propose"
  | "prices:manage"
  | "prices:view_margin"
  | "products:view"
  | "products:view_cost"
  | "sales_reps:view"
  | "integrations:bex"
  | "integrations:biznisoft"
  | "approvals:view"
  | "approvals:decide"
  | "audit:view"
  | "settings:manage";

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  region?: string;
}

export type CustomerStatus =
  "aktivan" | "u padu" | "nov" | "blokiran" | "neaktivan";

export interface CustomerContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  preferredChannel: "telefon" | "email" | "Viber" | "WhatsApp";
  contactWindow?: string;
}

export interface CustomerAddress {
  id: string;
  type: "sedište" | "fakturisanje" | "isporuka";
  street: string;
  city: string;
  postalCode: string;
  contactName?: string;
  phone?: string;
  deliveryNote?: string;
  access?: string;
  receivingHours?: string;
  complete: boolean;
}

export interface CustomerFinancialProfile {
  debt: number;
  overdueDebt: number;
  notDueDebt: number;
  oldestDebtDays: number;
  averageDelayDays: number;
  maxDelayDays: number;
  creditLimit: number;
  creditUsed: number;
  averageOrderValue: number;
  revenue30d: number;
  revenue90d: number;
  revenue365d: number;
  previousYearRevenue: number;
  grossMargin: number;
  averageMargin: number;
  profitability: number;
  deliveryCost: number;
  estimatedNetValue: number;
}

export interface CustomerSalesMetrics {
  orderCount: number;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  averageOrderGapDays: number;
  favoriteManufacturers: string[];
  favoriteGroups: string[];
  topProducts: string[];
  lostProducts: string[];
  trendPercent: number;
  potential: "visok" | "srednji" | "nizak";
  shareOfWallet: number;
  nextOpportunity: string;
  declineReason?: string;
}

export interface CustomerInternalAssessment {
  category: "A" | "B" | "C";
  strategicImportance: "visok" | "srednji" | "nizak";
  risk: "nizak" | "srednji" | "visok";
  paymentReliability: number;
  negotiationWeight: number;
  growthPotential: number;
  churnProbability: number;
  priceSensitivity: number;
  relationshipQuality: number;
  recommendedExposure: number;
  minimumMargin: number;
  warning?: string;
  confidentialNote?: string;
}

export interface Customer {
  id: string;
  code: string;
  bizniSoftCode?: string;
  companyName: string;
  legalName: string;
  pib: string;
  registrationNumber: string;
  vatStatus: string;
  legalForm: string;
  industry: string;
  cooperationSince: string;
  status: CustomerStatus;
  segment: "ključni" | "standard" | "razvojni" | "rizični";
  size: "mali" | "srednji" | "veliki";
  region: string;
  city: string;
  website?: string;
  source: string;
  salesRepId: string;
  salesRepName: string;
  contacts: CustomerContact[];
  addresses: CustomerAddress[];
  priceList: string;
  baseDiscount: number;
  paymentTermDays: number;
  paymentMethod: string;
  freeDelivery: boolean;
  minimumOrderValue: number;
  specialTerms?: string;
  specialTermsExpiresAt?: string;
  financial: CustomerFinancialProfile;
  sales: CustomerSalesMetrics;
  internal: CustomerInternalAssessment;
  openOrders: number;
  complaints: number;
  returns: number;
  averageProcessingHours: number;
  preferredDelivery: string;
  bexDataStatus: "usklađeno" | "nepotpuno" | "greška";
  bizniSoftSyncStatus: "usklađeno" | "neusklađeno" | "nije povezano";
  communicationNote?: string;
  aliases?: Record<string, string>;
}

export interface Manufacturer {
  id: string;
  name: string;
  code: string;
}

export interface ProductGroup {
  id: string;
  name: string;
  parentGroup?: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  packaging: string;
  sku: string;
  price: number;
  available: number;
}

export interface ProductAlias {
  id: string;
  customerId?: string;
  value: string;
  productId: string;
  confidence: number;
}

export interface Product {
  id: string;
  sku: string;
  catalogNumber: string;
  bizniSoftCode?: string;
  name: string;
  manufacturer: string;
  group: string;
  subgroup: string;
  packaging: string;
  status: "aktivan" | "povučen" | "najava";
  availability: "na stanju" | "nisko stanje" | "nema na stanju";
  mappingStatus: "mapiran" | "čeka mapiranje" | "greška";
  basePrice: number;
  purchasePrice: number;
  minimumPrice: number;
  averageSalePrice: number;
  averageMargin: number;
  customerCount: number;
  lastSaleAt: string;
  image?: string;
  variants: ProductVariant[];
  aliases: ProductAlias[];
  relatedProductIds: string[];
}

export type OrderStatus =
  | "nacrt"
  | "nova"
  | "čeka proveru"
  | "čeka potvrdu kupca"
  | "čeka odobrenje cene"
  | "potvrđena"
  | "rezervacija robe"
  | "čeka robu"
  | "spremna za fakturisanje"
  | "poslata u BizniSoft"
  | "spremna za pakovanje"
  | "spremna za BEX"
  | "preuzeta od kurira"
  | "u transportu"
  | "isporučena"
  | "delimično isporučena"
  | "otkazana"
  | "reklamacija"
  | "problem";

export type OrderSource =
  | "portal"
  | "telefon"
  | "email"
  | "Viber"
  | "WhatsApp"
  | "komercijalista"
  | "ručni unos"
  | "uvoz";

export interface OrderItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  originalInput?: string;
  quantity: number;
  regularPrice: number;
  appliedPrice: number;
  discount: number;
  margin: number;
  mappingConfidence?: number;
  mappingConfirmed: boolean;
  available: boolean;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  customerName: string;
  salesRepId: string;
  salesRepName: string;
  source: OrderSource;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  paymentStatus: "plaćeno" | "rok" | "kasni" | "pouzećem";
  bizniSoftStatus: "nije poslato" | "čeka" | "sinhronizovano" | "greška";
  bexStatus:
    | "nije kreirano"
    | "spremno"
    | "kreirano"
    | "u transportu"
    | "isporučeno"
    | "greška";
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  customerNote?: string;
  internalNote?: string;
  deliveryMethod: string;
  hasProblem: boolean;
  warnings: string[];
}

export interface PriceRuleTarget {
  pairIds?: string[];
  customerIds?: string[];
  customerSegments?: string[];
  salesRepIds?: string[];
  cities?: string[];
  regions?: string[];
  productIds?: string[];
  productGroups?: string[];
  manufacturers?: string[];
}

export type PriceChangeType =
  | "fixed"
  | "discount"
  | "rebate_increase"
  | "rebate_decrease"
  | "increase_percent"
  | "decrease_percent"
  | "increase_fixed"
  | "decrease_fixed"
  | "margin"
  | "rebate"
  | "quantity"
  | "promotion";

export interface PriceRule {
  id: string;
  name: string;
  priority: number;
  type: PriceChangeType;
  value: number;
  target: PriceRuleTarget;
  status: "aktivno" | "zakazano" | "isteklo" | "čeka odobrenje";
  validFrom: string;
  validTo?: string;
  minimumMargin: number;
  createdBy: string;
  createdAt: string;
  reason: string;
}

export interface PricePreviewRow {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  currentPrice: number;
  newPrice: number;
  currentDiscount: number;
  newDiscount: number;
  currentMargin: number;
  newMargin: number;
  difference: number;
  winningRule: string;
  winningRulePriority: number;
  winningRuleReason: string;
  conflictingRules: string[];
  warning?: string;
  excluded: boolean;
  outcome?:
    "ready" | "warning" | "approval" | "blocked" | "manual" | "excluded";
}

export interface PriceChangeBatch {
  id: string;
  name: string;
  reason: string;
  type: PriceChangeType;
  value: number;
  target: PriceRuleTarget;
  validFrom: string;
  validTo?: string;
  minimumMargin: number;
  rows: PricePreviewRow[];
  status: "nacrt" | "čeka odobrenje" | "primenjeno" | "odbijeno";
  createdBy: string;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  type:
    | "posebna cena"
    | "cena ispod marže"
    | "kreditni limit"
    | "kupac preko limita"
    | "izuzetak plaćanja"
    | "veći rabat"
    | "povrat robe"
    | "otkazivanje porudžbine"
    | "promena komercijaliste"
    | "reaktiviranje kupca";
  requestedBy: string;
  requestedAt: string;
  customerId: string;
  customerName: string;
  reason: string;
  currentValue: string;
  proposedValue: string;
  financialEffect: number;
  risk: "nizak" | "srednji" | "visok";
  status: "čeka" | "odobreno" | "odbijeno" | "dorada";
  comment?: string;
  priceBatchId?: string;
  productId?: string;
  productName?: string;
  proposedPrice?: number;
  proposedMargin?: number;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  userName: string;
  role: UserRole;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity: "info" | "warning" | "critical";
  reason: string;
  before: Record<string, string | number | boolean>;
  after: Record<string, string | number | boolean>;
}

export interface BexShipment {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  recipient: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  packageCount: number;
  weight: number;
  cashOnDelivery: number;
  note?: string;
  status:
    | "spremna"
    | "kreirana"
    | "greška"
    | "u transportu"
    | "isporučena"
    | "vraćena"
    | "odbijena";
  trackingNumber?: string;
  pickupAt?: string;
  deliveredAt?: string;
  validationIssues: string[];
}

export interface BizniSoftSyncRecord {
  id: string;
  entityType: "porudžbina" | "kupac" | "proizvod" | "cena" | "poreski podatak";
  entityId: string;
  entityLabel: string;
  status: "čeka" | "sinhronizovano" | "greška" | "neusaglašeno";
  localValue: string;
  remoteValue?: string;
  issue?: string;
  lastAttemptAt: string;
  retryCount: number;
}

export interface Notification {
  id: string;
  type:
    | "order"
    | "approval"
    | "risk"
    | "bex"
    | "biznisoft"
    | "customer"
    | "price"
    | "note"
    | "mapping";
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  href: string;
}

export interface Task {
  id: string;
  title: string;
  dueAt: string;
  assigneeId: string;
  customerId?: string;
  priority: "niska" | "srednja" | "visoka";
  completed: boolean;
}

export type DemoDataState =
  "normal" | "loading" | "empty" | "error" | "offline";
