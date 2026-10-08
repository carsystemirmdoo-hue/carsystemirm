/**
 * Predlog veze „šifra sa fakture → kupac", za ljudsku potvrdu.
 *
 * Čista logika, bez baze. Ulazi su šifarnik partnera (sirov izvoz), partneri
 * kako ih štampaju fakture i trenutno stanje baze (kupci po PIB-u, postojeće
 * spoljne šifre). Izlaz su predlozi i izdvojeni slučajevi — NIŠTA se ne upisuje
 * i nijedan nalog za prijavu se ne pravi.
 *
 * Pravilo potvrde je `confirmInvoicePartner`: jedinstvena šifra bez vodećih
 * nula u šifarniku + PIB sa fakture jednak PIB-u te šifre. Spajanja po nazivu
 * nema; naziv iz šifarnika služi samo čoveku pri pregledu.
 */
import { createHash } from "node:crypto";
import { classifyPib } from "../partners/pib.mjs";
import { buildPartnerRegister, confirmInvoicePartner } from "./partnerRegisterMatch.mjs";

export const LINK_ACTIONS = /** @type {const} */ ([
  "create_customer_and_link", // nov kupac + šifra sa fakture
  "link_existing_customer", // kupac sa istim PIB-om već postoji
  "already_linked", // šifra već pokazuje na kupca sa istim PIB-om — ništa
]);

/**
 * Otisak predloga. Primena ga računa ponovo nad stanjem baze u tom trenutku;
 * ako se razlikuje, predlog je zastareo i ne primenjuje se.
 */
export function proposalKey(p) {
  return createHash("sha256")
    .update(JSON.stringify([p.issuerCode, p.invoiceCode, p.registerCode, p.pib, p.action, p.customerId ?? null]))
    .digest("hex")
    .slice(0, 16);
}

/**
 * @param {object} input
 * @param {string} input.issuerCode  ista vrednost kao „izdavalac" pri uploadu PDF-a
 * @param {readonly { code: string, pib?: string|null, name?: string|null, city?: string|null, blocked?: boolean }[]} input.register
 * @param {readonly { code: string, pib: string|null, documents: number }[]} input.invoicePartners
 * @param {{ customersByPib: Map<string, { id: string, name: string }>,
 *           identifiers: Map<string, { customerId: string|null, status: string, customerPib?: string|null }> }} input.existing
 *        `identifiers` je po šifri tačno kako je odštampana, u opsegu izdavaoca.
 */
export function planCustomerLinks({ issuerCode, register, invoicePartners, existing }) {
  if (!String(issuerCode ?? "").trim()) throw new Error("Oznaka izdavaoca je obavezna.");
  const index = buildPartnerRegister(register);
  const byCode = new Map(register.map((r) => [String(r.code).trim(), r]));

  // Isti PIB pod dve šifre sa faktura nije stvar ovog alata — ide čoveku.
  const codesPerPib = new Map();
  for (const p of invoicePartners) {
    if (!p.pib) continue;
    codesPerPib.set(p.pib, new Set([...(codesPerPib.get(p.pib) ?? []), p.code]));
  }

  const proposals = [];
  const excluded = [];
  for (const p of [...invoicePartners].sort((a, b) => String(a.code).localeCompare(String(b.code)))) {
    const base = { issuerCode, invoiceCode: p.code, pib: p.pib, documents: p.documents };
    const match = confirmInvoicePartner({ code: p.code, pib: p.pib }, index);
    if (match.status !== "confirmed") {
      excluded.push({ ...base, registerCode: match.registerCode, reason: match.status });
      continue;
    }
    const entry = byCode.get(match.registerCode);
    const view = { ...base, registerCode: match.registerCode, name: entry?.name ?? null, city: entry?.city ?? null };
    if (entry?.blocked) { excluded.push({ ...view, reason: "partner_blocked_in_register" }); continue; }
    if ((codesPerPib.get(p.pib)?.size ?? 0) > 1) { excluded.push({ ...view, reason: "pib_under_several_invoice_codes" }); continue; }

    const ident = existing.identifiers.get(p.code);
    const customer = existing.customersByPib.get(p.pib);
    let action;
    let customerId = null;
    if (ident && ident.status === "disabled") { excluded.push({ ...view, reason: "identifier_disabled" }); continue; }
    if (ident && ident.status === "conflict") { excluded.push({ ...view, reason: "identifier_in_conflict" }); continue; }
    if (ident && ident.customerId) {
      if (customer && customer.id === ident.customerId) {
        action = "already_linked";
        customerId = ident.customerId;
      } else {
        excluded.push({ ...view, reason: "identifier_points_to_other_customer" });
        continue;
      }
    } else if (customer) {
      action = "link_existing_customer";
      customerId = customer.id;
    } else {
      // Nov kupac traži ispravan domaći PIB — isto pravilo kao registar partnera.
      if (classifyPib(p.pib).status !== "valid") { excluded.push({ ...view, reason: "pib_not_valid_for_new_customer" }); continue; }
      action = "create_customer_and_link";
    }
    const proposal = { ...view, action, customerId, existingCustomerName: customer?.name ?? null };
    proposals.push({ ...proposal, key: proposalKey(proposal) });
  }
  return { proposals, excluded };
}
