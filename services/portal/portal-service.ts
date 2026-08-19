import {
  approvalRequests,
  bexShipments,
  bizniSoftSyncRecords,
  customers,
  orders,
  priceRules,
  products,
} from "@/fixtures/dev/portal";
import type {
  ApprovalRequest,
  BexShipment,
  BizniSoftSyncRecord,
  Customer,
  Order,
  PriceChangeBatch,
  PricePreviewRow,
  PriceRule,
  Product,
} from "@/types/portal";

export interface PortalService {
  getCustomers(): Promise<Customer[]>;
  getCustomerById(id: string): Promise<Customer | undefined>;
  getOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  getProducts(): Promise<Product[]>;
  createMockOrder(
    input: Omit<Order, "id" | "number" | "createdAt" | "updatedAt">,
  ): Promise<Order>;
  previewPriceChange(
    input: Pick<
      PriceChangeBatch,
      "target" | "type" | "value" | "minimumMargin"
    >,
  ): Promise<PricePreviewRow[]>;
  applyMockPriceChange(batch: PriceChangeBatch): Promise<{
    success: true;
    affectedRows: number;
    approvalRequired: boolean;
  }>;
  getApprovalRequests(): Promise<ApprovalRequest[]>;
  getBexShipments(): Promise<BexShipment[]>;
  getBizniSoftSyncIssues(): Promise<BizniSoftSyncRecord[]>;
}

const wait = (milliseconds = 180) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function included<T>(filters: T[] | undefined, value: T) {
  return !filters?.length || filters.includes(value);
}

function nextPrice(
  currentPrice: number,
  product: Product,
  type: PriceChangeBatch["type"],
  value: number,
) {
  if (type === "fixed") return value;
  if (type === "promotion") return product.basePrice * (1 - value / 100);
  if (type === "discount") return product.basePrice * (1 - value / 100);
  if (type === "rebate") return product.basePrice * (1 - value / 100);
  if (type === "rebate_increase") {
    const currentRebate = (1 - currentPrice / product.basePrice) * 100;
    return product.basePrice * (1 - (currentRebate + value) / 100);
  }
  if (type === "rebate_decrease") {
    const currentRebate = (1 - currentPrice / product.basePrice) * 100;
    return product.basePrice * (1 - Math.max(0, currentRebate - value) / 100);
  }
  if (type === "decrease_percent" || type === "quantity")
    return currentPrice * (1 - value / 100);
  if (type === "increase_percent") return currentPrice * (1 + value / 100);
  if (type === "increase_fixed") return currentPrice + value;
  if (type === "decrease_fixed") return currentPrice - value;
  if (type === "margin")
    return product.purchasePrice / Math.max(0.01, 1 - value / 100);
  return currentPrice;
}

function targetPriority(
  target: PriceChangeBatch["target"],
  type: PriceChangeBatch["type"],
) {
  if (target.customerIds?.length && target.productIds?.length) return 1;
  if (target.customerIds?.length && target.productGroups?.length) return 2;
  if (target.customerIds?.length && target.manufacturers?.length) return 3;
  if (target.customerSegments?.length) return 4;
  if (type === "promotion") return 5;
  if (type === "quantity") return 6;
  return 7;
}

function ruleMatches(rule: PriceRule, customer: Customer, product: Product) {
  const target = rule.target;
  return (
    rule.status === "aktivno" &&
    included(target.pairIds, `${customer.id}:${product.id}`) &&
    included(target.customerIds, customer.id) &&
    included(target.customerSegments, customer.segment) &&
    included(target.salesRepIds, customer.salesRepId) &&
    included(target.cities, customer.city) &&
    included(target.regions, customer.region) &&
    included(target.productIds, product.id) &&
    included(target.productGroups, product.group) &&
    included(target.manufacturers, product.manufacturer)
  );
}

function priceFromRule(rule: PriceRule, product: Product) {
  return Math.max(
    1,
    Math.round(nextPrice(product.basePrice, product, rule.type, rule.value)),
  );
}

export const mockPortalService: PortalService = {
  async getCustomers() {
    await wait();
    return customers;
  },
  async getCustomerById(id) {
    await wait();
    return customers.find((customer) => customer.id === id);
  },
  async getOrders() {
    await wait();
    return orders;
  },
  async getOrderById(id) {
    await wait();
    return orders.find((order) => order.id === id);
  },
  async getProducts() {
    await wait();
    return products;
  },
  async createMockOrder(input) {
    await wait(500);
    const stamp = Date.now();
    return {
      ...input,
      id: `ord-mock-${stamp}`,
      number: `PO-2026-${String(8447 + (stamp % 100)).padStart(5, "0")}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  async previewPriceChange(input) {
    await wait(420);
    const targetCustomers = customers.filter(
      (customer) =>
        included(input.target.customerIds, customer.id) &&
        included(input.target.customerSegments, customer.segment) &&
        included(input.target.salesRepIds, customer.salesRepId) &&
        included(input.target.cities, customer.city) &&
        included(input.target.regions, customer.region),
    );
    const targetProducts = products.filter(
      (product) =>
        included(input.target.productIds, product.id) &&
        included(input.target.productGroups, product.group) &&
        included(input.target.manufacturers, product.manufacturer),
    );
    const pairs = targetCustomers.flatMap((customer) =>
      targetProducts.map((product) => ({ customer, product })),
    );
    return pairs.map(({ customer, product }, index) => {
      const fallbackDiscount = customer.baseDiscount + (index % 3);
      const matchingRules = priceRules
        .filter((rule) => ruleMatches(rule, customer, product))
        .sort(
          (a, b) =>
            targetPriority(a.target, a.type) -
              targetPriority(b.target, b.type) || a.priority - b.priority,
        );
      const currentWinner = matchingRules[0];
      const currentPrice = currentWinner
        ? priceFromRule(currentWinner, product)
        : Math.round(product.basePrice * (1 - fallbackDiscount / 100));
      const currentDiscount =
        Math.round((1 - currentPrice / product.basePrice) * 1000) / 10;
      const proposedPriority = targetPriority(input.target, input.type);
      const existingWins = Boolean(
        currentWinner &&
        targetPriority(currentWinner.target, currentWinner.type) <
          proposedPriority,
      );
      const proposedPrice = Math.max(
        1,
        Math.round(nextPrice(currentPrice, product, input.type, input.value)),
      );
      const calculatedPrice =
        existingWins && currentWinner ? currentPrice : proposedPrice;
      const newMargin =
        Math.round(
          ((calculatedPrice - product.purchasePrice) / calculatedPrice) * 1000,
        ) / 10;
      const newDiscount =
        Math.round((1 - calculatedPrice / product.basePrice) * 1000) / 10;
      const conflicts = matchingRules.map(
        (rule) =>
          `${rule.name} (prioritet ${targetPriority(rule.target, rule.type)})`,
      );
      const warnings = [
        newMargin < input.minimumMargin
          ? `Marža ${newMargin}% je ispod minimuma ${input.minimumMargin}%`
          : undefined,
        existingWins && currentWinner
          ? `${currentWinner.name} ima viši prioritet i zadržava postojeću cenu`
          : undefined,
        customer.financial.debt > customer.financial.creditLimit
          ? "Kupac je preko kreditnog limita"
          : undefined,
      ].filter(Boolean) as string[];
      const winningRule =
        existingWins && currentWinner
          ? currentWinner.name
          : "Novo bulk pravilo";
      const winningRulePriority =
        existingWins && currentWinner
          ? targetPriority(currentWinner.target, currentWinner.type)
          : proposedPriority;
      return {
        id: `preview-${customer.id}-${product.id}`,
        customerId: customer.id,
        customerName: customer.companyName,
        productId: product.id,
        productName: product.name,
        currentPrice,
        newPrice: calculatedPrice,
        currentDiscount,
        newDiscount,
        currentMargin:
          Math.round(
            ((currentPrice - product.purchasePrice) / currentPrice) * 1000,
          ) / 10,
        newMargin,
        difference: calculatedPrice - currentPrice,
        winningRule,
        winningRulePriority,
        winningRuleReason:
          existingWins && currentWinner
            ? `Postojeće pravilo nivoa ${winningRulePriority} pobeđuje novo pravilo nivoa ${proposedPriority}.`
            : `Novo pravilo nivoa ${proposedPriority} je najviši primenljivi prioritet za ovu kombinaciju.`,
        conflictingRules: conflicts,
        warning: warnings.length ? warnings.join(" · ") : undefined,
        excluded: false,
      };
    });
  },
  async applyMockPriceChange(batch) {
    await wait(650);
    return {
      success: true,
      affectedRows: batch.rows.filter(
        (row) => !row.excluded && row.outcome !== "blocked",
      ).length,
      approvalRequired: batch.rows.some(
        (row) =>
          !row.excluded &&
          row.outcome !== "blocked" &&
          (row.outcome === "approval" || row.newMargin < batch.minimumMargin),
      ),
    };
  },
  async getApprovalRequests() {
    await wait();
    return approvalRequests;
  },
  async getBexShipments() {
    await wait();
    return bexShipments;
  },
  async getBizniSoftSyncIssues() {
    await wait();
    return bizniSoftSyncRecords;
  },
};
