import type { Order, OrderItem, OrderSource, OrderStatus } from "@/types/portal";
import { customers } from "./customers";
import { products } from "./products";

const statuses: OrderStatus[] = [
  "nova", "čeka proveru", "čeka potvrdu kupca", "čeka robu", "spremna za fakturisanje",
  "spremna za BEX", "u transportu", "isporučena", "problem", "čeka odobrenje cene",
  "potvrđena", "spremna za pakovanje", "poslata u BizniSoft", "reklamacija", "delimično isporučena",
];

const sources: OrderSource[] = ["telefon", "email", "Viber", "WhatsApp", "komercijalista", "ručni unos", "portal", "uvoz"];

const issueByIndex: Record<number, string[]> = {
  2: ["Nepotpuna adresa za isporuku"],
  5: ["Cena druge stavke zahteva odobrenje gazde"],
  8: ["Proizvod nije sigurno prepoznat", "Kupac ima dospela dugovanja"],
  13: ["BEX nije prihvatio poštanski broj"],
  17: ["Proizvod nema BizniSoft šifru"],
  21: ["Kupac je preko kreditnog limita"],
};

function makeItem(orderIndex: number, itemIndex: number): OrderItem {
  const product = products[(orderIndex * 3 + itemIndex * 5) % products.length];
  const quantity = 1 + ((orderIndex + itemIndex) % 6);
  const discount = 6 + ((orderIndex + itemIndex) % 5) * 2;
  const appliedPrice = Math.round(product.basePrice * (1 - discount / 100));
  const originalInputs = ["cosmos sprej crni", "ona sia 150", "RM učvršćivač", "crni git 1kg"];
  const uncertain = orderIndex === 8 && itemIndex === 0;
  return {
    id: `item-${orderIndex + 1}-${itemIndex + 1}`,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    originalInput: uncertain ? originalInputs[orderIndex % originalInputs.length] : undefined,
    quantity,
    regularPrice: product.basePrice,
    appliedPrice,
    discount,
    margin: Math.round(((appliedPrice - product.purchasePrice) / appliedPrice) * 100),
    mappingConfidence: uncertain ? 72 : 98,
    mappingConfirmed: !uncertain,
    available: product.availability !== "nema na stanju",
  };
}

export const orders: Order[] = Array.from({ length: 25 }, (_, index) => {
  const customer = customers[(index * 4) % customers.length];
  const itemCount = 1 + (index % 4);
  const items = Array.from({ length: itemCount }, (_, itemIndex) => makeItem(index, itemIndex));
  const warnings = issueByIndex[index] ?? [];
  const status = warnings.length ? (index % 2 === 0 ? "problem" : statuses[index % statuses.length]) : statuses[index % statuses.length];
  const total = items.reduce((sum, item) => sum + item.appliedPrice * item.quantity, 0);
  const day = String(4 - (index % 4)).padStart(2, "0");
  const hour = String(8 + (index % 9)).padStart(2, "0");
  return {
    id: `ord-${index + 1}`,
    number: `PO-2026-${String(8421 + index).padStart(5, "0")}`,
    createdAt: `2026-08-${day}T${hour}:${index % 2 ? "35" : "10"}:00`,
    updatedAt: `2026-08-04T${String(9 + (index % 8)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}:00`,
    customerId: customer.id,
    customerName: customer.companyName,
    salesRepId: customer.salesRepId,
    salesRepName: customer.salesRepName,
    source: sources[index % sources.length],
    status,
    items,
    total,
    paymentMethod: customer.paymentMethod,
    paymentStatus: customer.financial.overdueDebt > 100000 ? "kasni" : index % 5 === 0 ? "pouzećem" : "rok",
    bizniSoftStatus: status === "isporučena" ? "sinhronizovano" : index % 9 === 0 ? "greška" : index % 3 === 0 ? "čeka" : "nije poslato",
    bexStatus: status === "isporučena" ? "isporučeno" : status === "u transportu" ? "u transportu" : index % 13 === 0 ? "greška" : status === "spremna za BEX" ? "spremno" : "nije kreirano",
    contactName: customer.contacts[0]?.name ?? "Kontakt nije unet",
    contactPhone: customer.contacts[0]?.phone ?? "",
    deliveryAddress: customer.addresses[0] ? `${customer.addresses[0].street}, ${customer.addresses[0].city}` : "Adresa nije uneta",
    customerNote: index % 4 === 0 ? "Isporuka do 14 časova. Pozvati pre dolaska." : undefined,
    internalNote: index % 6 === 0 ? "Proveriti zamenski učvršćivač pre potvrde." : undefined,
    deliveryMethod: index % 3 === 0 ? "Lični prevoz" : "BEX standard",
    hasProblem: warnings.length > 0 || status === "problem",
    warnings,
  };
});
