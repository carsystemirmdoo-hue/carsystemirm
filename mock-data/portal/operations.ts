import type {
  ApprovalRequest,
  AuditEvent,
  BexShipment,
  BizniSoftSyncRecord,
  Notification,
  PriceRule,
  Task,
} from "@/types/portal";
import { customers } from "./customers";
import { orders } from "./orders";
import { products } from "./products";

export const priceRules: PriceRule[] = [
  {
    id: "rule-1",
    name: "Auto Color NS, R-M lakovi",
    priority: 1,
    type: "discount",
    value: 14,
    target: {
      customerIds: ["cus-1"],
      manufacturers: ["R-M"],
      productGroups: ["Bezbojni lakovi"],
    },
    status: "aktivno",
    validFrom: "2026-05-01",
    validTo: "2026-12-31",
    minimumMargin: 20,
    createdBy: "Milan Jovanović",
    createdAt: "2026-04-28T10:20:00",
    reason: "Godišnji partnerski dogovor",
  },
  {
    id: "rule-2",
    name: "Vojvodina, Carsystem brusni program",
    priority: 4,
    type: "discount",
    value: 9,
    target: {
      regions: ["Vojvodina"],
      manufacturers: ["Carsystem"],
      productGroups: ["Brusni materijal"],
    },
    status: "aktivno",
    validFrom: "2026-07-01",
    minimumMargin: 19,
    createdBy: "Milan Jovanović",
    createdAt: "2026-06-25T14:05:00",
    reason: "Razvoj regionalne prodaje",
  },
  {
    id: "rule-3",
    name: "Avgust, R-M i baslac učvršćivači",
    priority: 5,
    type: "promotion",
    value: 6,
    target: {
      manufacturers: ["R-M", "baslac"],
      productGroups: ["Učvršćivači"],
    },
    status: "aktivno",
    validFrom: "2026-08-01",
    validTo: "2026-08-31",
    minimumMargin: 18,
    createdBy: "Milan Jovanović",
    createdAt: "2026-07-29T09:40:00",
    reason: "Sezonska promocija",
  },
  {
    id: "rule-4",
    name: "Ključni kupci, količinski prag",
    priority: 6,
    type: "quantity",
    value: 4,
    target: { customerSegments: ["ključni"] },
    status: "aktivno",
    validFrom: "2026-01-01",
    minimumMargin: 20,
    createdBy: "Milan Jovanović",
    createdAt: "2025-12-18T12:15:00",
    reason: "Godišnja komercijalna politika",
  },
  {
    id: "rule-5",
    name: "Balkan Refinish posebna cena",
    priority: 1,
    type: "fixed",
    value: 5390,
    target: { customerIds: ["cus-8"], productIds: ["prd-1"] },
    status: "čeka odobrenje",
    validFrom: "2026-08-15",
    validTo: "2026-09-30",
    minimumMargin: 18,
    createdBy: "Tamara Kovač",
    createdAt: "2026-08-04T09:55:00",
    reason: "Odgovor na konkurentsku ponudu",
  },
  {
    id: "rule-6",
    name: "Prolećna SATA akcija",
    priority: 5,
    type: "promotion",
    value: 5,
    target: { manufacturers: ["SATA"] },
    status: "isteklo",
    validFrom: "2026-03-01",
    validTo: "2026-05-31",
    minimumMargin: 21,
    createdBy: "Milan Jovanović",
    createdAt: "2026-02-20T08:30:00",
    reason: "Promotivni period",
  },
];

export const approvalRequests: ApprovalRequest[] = [
  {
    id: "apr-1",
    type: "cena ispod marže",
    requestedBy: "Marko Petrović",
    requestedAt: "2026-08-04T09:45:00",
    customerId: "cus-1",
    customerName: "Auto Color NS",
    reason: "Kupac poredi sa ponudom konkurenta za kompletan R-M sistem.",
    currentValue: "22,4% marže",
    proposedValue: "17,8% marže",
    financialEffect: -38600,
    risk: "srednji",
    status: "čeka",
  },
  {
    id: "apr-2",
    type: "kreditni limit",
    requestedBy: "Nenad Simić",
    requestedAt: "2026-08-04T08:20:00",
    customerId: "cus-2",
    customerName: "Lak Centar Dunav",
    reason: "Sezonski rast i dve velike porudžbine u najavi.",
    currentValue: "500.000 RSD",
    proposedValue: "750.000 RSD",
    financialEffect: 250000,
    risk: "srednji",
    status: "čeka",
  },
  {
    id: "apr-3",
    type: "reaktiviranje kupca",
    requestedBy: "Ana Ristić",
    requestedAt: "2026-08-03T15:40:00",
    customerId: "cus-6",
    customerName: "Kolor Servis Šumadija",
    reason: "Dogovoren plan naplate u tri tranše.",
    currentValue: "Blokiran",
    proposedValue: "Aktivan uz avans",
    financialEffect: 180000,
    risk: "visok",
    status: "čeka",
  },
  {
    id: "apr-4",
    type: "veći rabat",
    requestedBy: "Luka Nikolić",
    requestedAt: "2026-08-03T12:10:00",
    customerId: "cus-12",
    customerName: "Duga Color",
    reason: "Prva sistemska porudžbina novog kupca.",
    currentValue: "8%",
    proposedValue: "12%",
    financialEffect: -12400,
    risk: "nizak",
    status: "dorada",
    comment: "Dopuniti očekivani mesečni obim.",
  },
  {
    id: "apr-5",
    type: "povrat robe",
    requestedBy: "Tamara Kovač",
    requestedAt: "2026-08-02T11:05:00",
    customerId: "cus-8",
    customerName: "Balkan Refinish",
    reason: "Pogrešno naručeno pakovanje.",
    currentValue: "Bez povrata",
    proposedValue: "Povrat 46.900 RSD",
    financialEffect: -46900,
    risk: "srednji",
    status: "odobreno",
    comment: "Odobreno uz neoštećenu ambalažu.",
  },
];

export const bexShipments: BexShipment[] = orders
  .slice(0, 12)
  .map((order, index) => {
    const customer = customers.find((item) => item.id === order.customerId)!;
    const address = customer.addresses[0];
    const invalid = index === 2 || index === 7;
    return {
      id: `bex-${index + 1}`,
      orderId: order.id,
      orderNumber: order.number,
      customerName: customer.companyName,
      recipient: invalid && index === 7 ? "" : order.contactName,
      phone: invalid && index === 2 ? "" : order.contactPhone,
      address: address?.street ?? "",
      city: customer.city,
      postalCode: invalid ? "" : (address?.postalCode ?? ""),
      packageCount: 1 + (index % 3),
      weight: 3.4 + index * 1.2,
      cashOnDelivery: index % 4 === 0 ? order.total : 0,
      note: address?.deliveryNote,
      status: invalid
        ? "greška"
        : (["spremna", "kreirana", "u transportu", "isporučena"][
            index % 4
          ] as BexShipment["status"]),
      trackingNumber:
        index % 4 === 0 ? undefined : `BEX${String(93100420 + index)}`,
      pickupAt: index % 4 > 0 ? "2026-08-03T14:30:00" : undefined,
      deliveredAt: index % 4 === 3 ? "2026-08-04T12:18:00" : undefined,
      validationIssues: invalid
        ? index === 2
          ? ["Nedostaje telefon", "Neispravan poštanski broj"]
          : ["Nedostaje primalac", "Nepotpuna adresa"]
        : [],
    };
  });

export const bizniSoftSyncRecords: BizniSoftSyncRecord[] = [
  {
    id: "bs-1",
    entityType: "porudžbina",
    entityId: "ord-1",
    entityLabel: "PO-2026-08421",
    status: "čeka",
    localValue: "3 stavke, 64.820 RSD",
    lastAttemptAt: "2026-08-04T10:14:00",
    retryCount: 0,
  },
  {
    id: "bs-2",
    entityType: "kupac",
    entityId: "cus-1",
    entityLabel: "Auto Color NS",
    status: "neusaglašeno",
    localValue: "Rok 45 dana",
    remoteValue: "Rok 30 dana",
    issue: "Rok plaćanja se razlikuje",
    lastAttemptAt: "2026-08-04T10:12:00",
    retryCount: 1,
  },
  {
    id: "bs-3",
    entityType: "proizvod",
    entityId: "prd-14",
    entityLabel: "35-M331 Toner",
    status: "greška",
    localValue: "KAT-7421",
    issue: "Nedostaje BizniSoft šifra",
    lastAttemptAt: "2026-08-04T10:11:00",
    retryCount: 3,
  },
  {
    id: "bs-4",
    entityType: "cena",
    entityId: "rule-2",
    entityLabel: "Vojvodina, Carsystem brusni program",
    status: "neusaglašeno",
    localValue: "-9%",
    remoteValue: "-7%",
    issue: "Razlika aktivnog rabata",
    lastAttemptAt: "2026-08-04T10:08:00",
    retryCount: 1,
  },
  {
    id: "bs-5",
    entityType: "poreski podatak",
    entityId: "cus-6",
    entityLabel: "Kolor Servis Šumadija",
    status: "greška",
    localValue: "PIB 108235245",
    remoteValue: "PIB nije pronađen",
    issue: "Kupac nije povezan",
    lastAttemptAt: "2026-08-04T09:58:00",
    retryCount: 2,
  },
  {
    id: "bs-6",
    entityType: "porudžbina",
    entityId: "ord-8",
    entityLabel: "PO-2026-08428",
    status: "sinhronizovano",
    localValue: "2 stavke, 18.420 RSD",
    remoteValue: "2 stavke, 18.420 RSD",
    lastAttemptAt: "2026-08-04T09:52:00",
    retryCount: 0,
  },
];

const auditActions = [
  "Promenjena cena",
  "Promenjen rabat",
  "Odobren zahtev",
  "Kreirana porudžbina",
  "Promenjen status porudžbine",
  "Promenjena adresa",
  "Kreirana BEX pošiljka",
  "Poslat podatak u BizniSoft",
  "Promenjen komercijalista",
  "Dodat sinonim proizvoda",
];
export const auditEvents: AuditEvent[] = Array.from(
  { length: 18 },
  (_, index) => {
    const entityKind = index % 3;
    const entity =
      entityKind === 0
        ? customers[index % customers.length]
        : entityKind === 1
          ? orders[index % orders.length]
          : products[index % products.length];
    return {
      id: `evt-${index + 1}`,
      occurredAt: `2026-08-${String(4 - (index % 3)).padStart(2, "0")}T${String(8 + (index % 9)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}:00`,
      userName: [
        "Milan Jovanović",
        "Marko Petrović",
        "Jelena Ilić",
        "Tamara Kovač",
      ][index % 4],
      role: (["owner", "sales", "office", "sales"] as const)[index % 4],
      action: auditActions[index % auditActions.length],
      module: ["Cene", "Porudžbine", "Kupci", "BEX", "BizniSoft"][index % 5],
      entityType:
        entityKind === 0
          ? "Kupac"
          : entityKind === 1
            ? "Porudžbina"
            : "Proizvod",
      entityId: entity.id,
      entityLabel:
        "companyName" in entity
          ? entity.companyName
          : "number" in entity
            ? entity.number
            : entity.name,
      severity:
        index % 8 === 0 ? "critical" : index % 4 === 0 ? "warning" : "info",
      reason:
        index % 3 === 0
          ? "Dogovor sa kupcem i operativna korekcija"
          : "Redovna obrada poslovnog događaja",
      before: {
        status: index % 2 ? "čeka proveru" : "standard",
        vrednost: 21800 + index * 410,
      },
      after: {
        status: index % 2 ? "potvrđena" : "izmenjeno",
        vrednost: 22600 + index * 430,
      },
    };
  },
);

export const notifications: Notification[] = [
  {
    id: "not-1",
    type: "order",
    title: "Nova telefonska porudžbina",
    description: "Auto Color NS, 4 stavke",
    createdAt: "2026-08-04T10:32:00",
    read: false,
    href: "/portal/porudzbine/ord-1",
  },
  {
    id: "not-2",
    type: "approval",
    title: "Cena čeka odobrenje",
    description: "Predlog je ispod minimalne marže",
    createdAt: "2026-08-04T09:45:00",
    read: false,
    href: "/portal/odobrenja",
  },
  {
    id: "not-3",
    type: "bex",
    title: "BEX validacija nije prošla",
    description: "Nedostaje telefon primaoca",
    createdAt: "2026-08-04T09:18:00",
    read: false,
    href: "/portal/bex",
  },
  {
    id: "not-4",
    type: "biznisoft",
    title: "Cena nije usaglašena",
    description: "Carsystem brusni program, razlika 2%",
    createdAt: "2026-08-04T08:54:00",
    read: true,
    href: "/portal/biznissoft",
  },
  {
    id: "not-5",
    type: "customer",
    title: "Kupac nije naručivao 60 dana",
    description: "Balkan Refinish zahteva kontakt",
    createdAt: "2026-08-03T16:10:00",
    read: true,
    href: "/portal/kupci/cus-8",
  },
  {
    id: "not-6",
    type: "price",
    title: "Posebna cena uskoro ističe",
    description: "3 pravila ističu do kraja meseca",
    createdAt: "2026-08-03T14:22:00",
    read: false,
    href: "/portal/cene/pravila",
  },
];

export const tasks: Task[] = [
  {
    id: "task-1",
    title: "Pozvati Balkan Refinish zbog pada prometa",
    dueAt: "2026-08-04T11:30:00",
    assigneeId: "usr-tamara",
    customerId: "cus-8",
    priority: "visoka",
    completed: false,
  },
  {
    id: "task-2",
    title: "Dopuniti adresu Kolor Servis Šumadija",
    dueAt: "2026-08-04T12:00:00",
    assigneeId: "usr-jelena",
    customerId: "cus-6",
    priority: "visoka",
    completed: false,
  },
  {
    id: "task-3",
    title: "Proveriti R-M cenovnik za Auto Color NS",
    dueAt: "2026-08-04T14:30:00",
    assigneeId: "usr-marko",
    customerId: "cus-1",
    priority: "srednja",
    completed: false,
  },
  {
    id: "task-4",
    title: "Potvrditi preuzimanje za PO-2026-08427",
    dueAt: "2026-08-04T15:00:00",
    assigneeId: "usr-jelena",
    priority: "srednja",
    completed: true,
  },
];
