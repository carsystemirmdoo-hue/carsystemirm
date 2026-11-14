import "server-only";
import { notify } from "@/lib/notifications/notification-service";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";

/**
 * Obaveštenja kancelariji o zahtevima kupaca (0046, revizija 2026-10-11 B3).
 *
 * Šalju se POSLE upisa zahteva, van njegove transakcije: neuspelo obaveštenje
 * ne sme da obori zahtev koji je kupac već poslao. `dedupeKey` čuva od dvostrukog
 * zapisa pri ponovljenom slanju istim ključem.
 *
 * Vidljivost zahteva za porudžbinu: `customer_orders:review` (kancelarija,
 * vlasnik) — komercijalista ih samo čita, korak nije njegov.
 *
 * Upit za cenu: `price_requests:handle` uz `customerId` (0063). Na upit
 * odgovara i komercijalista, a red vezan za kupca vidi samo ko tog kupca ima
 * u opsegu — komercijalista svoje, kancelarija i vlasnik sve.
 * Telo nosi samo broj, naziv firme i brojeve — bez kontakta kupca.
 */
const CAPABILITY = "customer_orders:review";
const PRICE_REQUEST_CAPABILITY = "price_requests:handle";
const PRICE_REQUEST_TITLE = {
  no_price: "Nov upit za cenu",
  special_terms: "Nov zahtev za posebne uslove",
  procurement: "Nov upit za nabavku",
} as const;

async function safely(run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    console.error("obaveštenje o zahtevu kupca nije upisano", error);
  }
}

export async function notifyOrderSubmitted(input: {
  orderId: string;
  requestNumber: string;
  customerName: string;
  lineCount: number;
  onRequest: number;
  revision: boolean;
}) {
  await safely(() =>
    notify({
      kind: "customer_order_submitted",
      severity: "info",
      requiredCapability: CAPABILITY,
      title: input.revision ? `Kupac je potvrdio izmenjen predlog ${input.requestNumber}` : `Nov zahtev za porudžbinu ${input.requestNumber}`,
      body: `${input.customerName}: ${countOf(input.lineCount, STAVKA)}${input.onRequest ? `, na upit ${input.onRequest}` : ""}. Zahtev čeka pregled kancelarije.`,
      entityType: "Zahtev za porudžbinu",
      entityId: input.orderId,
      actionHref: `/portal/zahtevi/${input.orderId}`,
      context: { stavki: input.lineCount, naUpit: input.onRequest },
      dedupeKey: `customer_order_submitted:${input.orderId}`,
    }),
  );
}

export async function notifyPriceRequestSubmitted(input: {
  requestId: string;
  customerId: string;
  kind: "no_price" | "special_terms" | "procurement";
  requestNumber: string;
  customerName: string;
  productName: string;
}) {
  await safely(() =>
    notify({
      kind: "customer_price_request_submitted",
      severity: "info",
      requiredCapability: PRICE_REQUEST_CAPABILITY,
      customerId: input.customerId,
      title: `${PRICE_REQUEST_TITLE[input.kind]} ${input.requestNumber}`,
      body: `${input.customerName}: ${input.productName}. Upit čeka odgovor.`,
      entityType: "Upit za cenu",
      entityId: input.requestId,
      actionHref: "/portal/zahtevi/uslovi",
      dedupeKey: `customer_price_request_submitted:${input.requestId}`,
    }),
  );
}
