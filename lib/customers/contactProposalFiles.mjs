/**
 * Grupni predlog kontakata kupaca — čista pravila, bez baze i bez fajl-sistema.
 *
 * Tabela nastaje van portala iz kartica partnera; kancelarija je pregleda i
 * potvrđuje red po red. Ovde se ona čita i upoređuje sa stanjem baze. Rezultat
 * je isti nalog koji pravi pojedinačni predlog: `requested`, bez lozinke i bez
 * prava prijave. Potvrda OSOBE i poziv su posebni koraci i ovde se ne dešavaju.
 *
 * Firma se nalazi SAMO po povezanoj (`mapped`) šifri sa fakture; PIB iz
 * tabele je provera, nikad ključ, a naziv se ne koristi za spajanje.
 */

import { parseSemicolonCsv } from "../commercial/linkReviewFiles.mjs";

/** Kolone tabele, tačnim redom. */
export const CONTACT_COLUMNS = Object.freeze([
  "sifra_na_fakturi", "pib", "naziv", "e_adresa", "ime", "odluka", "potvrdio", "napomena",
]);

export class ContactProposalError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ContactProposalError";
    this.code = code;
  }
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

/** Ista pravila kao pojedinačni predlog (e-pošta ≤ 254, ime 2–120, razlog 3–500). */
export function isValidContactEmail(email) {
  return email.length <= 254 && EMAIL_RE.test(email) && !email.includes("..");
}

/**
 * @param {string} text
 * @returns {{ red: number, code: string, pib: string, email: string, name: string,
 *             decision: "" | "potvrdi" | "odbij", confirmedBy: string, note: string }[]}
 */
export function readContactProposals(text) {
  const [head, ...rows] = parseSemicolonCsv(text);
  if (!head || head.length !== CONTACT_COLUMNS.length || head.some((h, i) => h.trim() !== CONTACT_COLUMNS[i])) {
    throw new ContactProposalError(`Tabela mora imati tačno kolone: ${CONTACT_COLUMNS.join(";")}.`, "columns");
  }
  if (rows.length === 0) throw new ContactProposalError("Tabela nema redova.", "empty");
  if (rows.length > 2000) throw new ContactProposalError("Tabela ima više od 2000 redova.", "too_many");
  return rows.map((r, i) => {
    const c = (k) => String(r[CONTACT_COLUMNS.indexOf(k)] ?? "").trim();
    const decision = c("odluka").toLowerCase();
    if (decision !== "" && decision !== "potvrdi" && decision !== "odbij") {
      throw new ContactProposalError(`Red ${i + 2}: odluka je „potvrdi", „odbij" ili prazno.`, "decision");
    }
    return {
      red: i + 2,
      code: c("sifra_na_fakturi"),
      pib: c("pib"),
      email: c("e_adresa").toLowerCase(),
      name: c("ime"),
      decision: /** @type {"" | "potvrdi" | "odbij"} */ (decision),
      confirmedBy: c("potvrdio"),
      note: c("napomena"),
    };
  });
}

/** Ishodi; sve osim `would_create`/`created` i `already_present` je izdvojeno za čoveka. */
export const CONTACT_OUTCOMES = Object.freeze({
  would_create: "biće upisano",
  created: "upisano",
  already_present: "već upisan istovetan kontakt — preskočeno",
  not_confirmed: "nije potvrđeno u tabeli — preskočeno",
  invalid_row: "neispravan red (e-pošta, ime ili napomena)",
  duplicate_in_file: "ista e-pošta više puta u tabeli",
  code_not_mapped: "šifra nije povezana sa kupcem",
  pib_mismatch: "PIB u tabeli ≠ PIB kupca",
  customer_inactive: "kupac je neaktivan",
  email_taken_other_customer: "e-pošta već pripada nalogu druge firme",
  customer_has_other_contact: "kupac već ima drugi kontakt",
});

/**
 * Plan nad stanjem baze.
 *
 * @param {{
 *   rows: ReturnType<typeof readContactProposals>,
 *   customersByCode: Map<string, { id: string, pib: string | null, active: boolean }>,
 *   accountsByEmail: Map<string, { customerId: string }>,
 *   accountsByCustomer: Map<string, { email: string, status: string }[]>,
 * }} input
 * @returns {{ row: ReturnType<typeof readContactProposals>[number], customerId: string | null,
 *             outcome: keyof typeof CONTACT_OUTCOMES }[]}
 */
export function planContactProposals({ rows, customersByCode, accountsByEmail, accountsByCustomer }) {
  const seen = new Map();
  for (const r of rows) if (r.email) seen.set(r.email, (seen.get(r.email) ?? 0) + 1);
  return rows.map((row) => {
    const customer = customersByCode.get(row.code) ?? null;
    const out = (outcome) => ({ row, customerId: customer?.id ?? null, outcome });
    if (row.decision !== "potvrdi" || !row.confirmedBy) return out("not_confirmed");
    if (!isValidContactEmail(row.email) || row.name.length < 2 || row.name.length > 120 || row.note.length < 3 || row.note.length > 500) {
      return out("invalid_row");
    }
    if ((seen.get(row.email) ?? 0) > 1) return out("duplicate_in_file");
    if (!customer) return out("code_not_mapped");
    if ((customer.pib ?? "") !== row.pib) return out("pib_mismatch");
    if (!customer.active) return out("customer_inactive");
    const byEmail = accountsByEmail.get(row.email);
    if (byEmail) return out(byEmail.customerId === customer.id ? "already_present" : "email_taken_other_customer");
    const others = (accountsByCustomer.get(customer.id) ?? []).filter((a) => a.status !== "rejected");
    if (others.length) return out("customer_has_other_contact");
    return out("would_create");
  });
}

/** Razlog koji ide uz nalog i u trag: ko je potvrdio u tabeli, ko je primenio, izvor adrese. */
export function proposalReason(row, actorName) {
  return `${row.note} Potvrdio u tabeli: ${row.confirmedBy}; primenio: ${actorName}. Izvor adrese: BizniSoft kartica partnera.`.slice(0, 500);
}
