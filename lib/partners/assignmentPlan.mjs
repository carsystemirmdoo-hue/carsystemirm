/**
 * Plan dodele kupaca komercijalistima iz BizniSoft šifre komercijaliste.
 *
 * Čista funkcija: prima snimak, vraća predlog. Ništa ne upisuje i ništa ne
 * briše — primena je zaseban, revidiran korak (`lib/partners/assignment-service.ts`).
 *
 * Predlog nastaje SAMO kada je lanac ceo i jednoznačan:
 *
 *   kartica partnera (šifra komercijaliste)
 *     → `salespeople.source_code` povezan sa korisnikom (potvrdio gazda)
 *     → korisnik je aktivan komercijalista
 *   šifra partnera → `mapped` kupac u portalu
 *
 * Ako jedan kupac ima više šifara partnera (poslovnice) sa RAZLIČITIM
 * komercijalistima, plan ga preskače kao sukob. Izbor bi značio da jedan
 * komercijalista tiho izgubi ili dobije kupca.
 *
 * Plan je aditivan: postojeće dodele ne uklanja. Uklanjanje je uvek izričita
 * radnja čoveka.
 */

/** @typedef {"no_rep_code" | "partner_not_mapped" | "rep_code_not_linked" | "rep_user_not_eligible" | "customer_rep_conflict"} SkipReason */

export const SKIP_REASONS = /** @type {const} */ ({
  no_rep_code: "Kartica partnera nema šifru komercijaliste.",
  partner_not_mapped: "Šifra partnera nije povezana sa kupcem u portalu.",
  rep_code_not_linked: "Šifra komercijaliste nije povezana sa korisnikom portala.",
  rep_user_not_eligible: "Povezani korisnik nije aktivan komercijalista.",
  customer_rep_conflict:
    "Kupac ima više šifara partnera sa različitim komercijalistima — odlučuje čovek.",
});

/**
 * @param {{
 *   partners: readonly { partnerCode: string, repCode: string | null }[],
 *   identifiers: readonly { partnerCode: string, customerId: string | null, status: string }[],
 *   salespeople: readonly { sourceCode: string, userId: string | null, userRole: string | null, userActive: boolean | null }[],
 *   existing: readonly { userId: string, customerId: string }[],
 * }} input
 */
export function planAssignments({ partners, identifiers, salespeople, existing }) {
  const idByCode = new Map(identifiers.map((i) => [i.partnerCode, i]));
  const repByCode = new Map(salespeople.map((s) => [s.sourceCode, s]));
  const existingKey = new Set(existing.map((e) => `${e.userId}|${e.customerId}`));

  /** @type {{ partnerCode: string, reason: SkipReason, detail?: string }[]} */
  const skipped = [];
  /** @type {Map<string, { userIds: Set<string>, repCodes: Set<string>, partnerCodes: string[] }>} */
  const perCustomer = new Map();

  for (const p of partners) {
    if (!p.repCode) {
      skipped.push({ partnerCode: p.partnerCode, reason: "no_rep_code" });
      continue;
    }
    const identity = idByCode.get(p.partnerCode);
    if (!identity || identity.status !== "mapped" || !identity.customerId) {
      skipped.push({ partnerCode: p.partnerCode, reason: "partner_not_mapped" });
      continue;
    }
    const rep = repByCode.get(p.repCode);
    if (!rep || !rep.userId) {
      skipped.push({ partnerCode: p.partnerCode, reason: "rep_code_not_linked", detail: p.repCode });
      continue;
    }
    if (rep.userRole !== "komercijalista" || rep.userActive !== true) {
      skipped.push({ partnerCode: p.partnerCode, reason: "rep_user_not_eligible", detail: p.repCode });
      continue;
    }
    const entry = perCustomer.get(identity.customerId) ?? {
      userIds: new Set(),
      repCodes: new Set(),
      partnerCodes: [],
    };
    entry.userIds.add(rep.userId);
    entry.repCodes.add(p.repCode);
    entry.partnerCodes.push(p.partnerCode);
    perCustomer.set(identity.customerId, entry);
  }

  /** @type {{ customerId: string, userId: string, repCode: string, partnerCodes: string[] }[]} */
  const proposed = [];
  /** @type {{ customerId: string, userId: string }[]} */
  const alreadyAssigned = [];

  for (const [customerId, entry] of [...perCustomer].sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.userIds.size > 1) {
      for (const code of entry.partnerCodes) {
        skipped.push({
          partnerCode: code,
          reason: "customer_rep_conflict",
          detail: [...entry.repCodes].sort().join(", "),
        });
      }
      continue;
    }
    const [userId] = entry.userIds;
    const [repCode] = entry.repCodes;
    if (existingKey.has(`${userId}|${customerId}`)) {
      alreadyAssigned.push({ customerId, userId });
    } else {
      proposed.push({ customerId, userId, repCode, partnerCodes: [...entry.partnerCodes].sort() });
    }
  }

  return { proposed, alreadyAssigned, skipped };
}
