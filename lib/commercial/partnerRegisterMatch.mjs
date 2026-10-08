/**
 * Potvrda partnera sa fakture prema šifarniku BizniSoft-a.
 *
 * Zašto postoji: faktura štampa šifru partnera sa vodećim nulama („00028"),
 * a izvoz šifarnika istu šifru bez njih („28"). `isSamePartnerCode` namerno
 * poredi tačan tekst i to ostaje pravilo svuda drugde. Ovde se normalizovano
 * poređenje uvodi SAMO uz dva dokaza:
 *
 *   1. ključ bez vodećih nula je u šifarniku jedinstven (nema kolizije
 *      „028" / „28"); kolizija se ne razrešava, nego ide čoveku;
 *   2. PIB sa fakture je isti kao PIB te šifre u šifarniku.
 *
 * PIB je POTVRDA, ne ključ: partner se nikad ne nalazi po PIB-u (jedan PIB
 * legitimno nosi više kartica, vidi `pibIsAutoMergeEvidence`), a nikad ni po
 * nazivu. Obe izvorne vrednosti se vraćaju neizmenjene, da se čuvaju uz vezu.
 *
 * Šifarnik sadrži i dobavljače: potvrđen partner NIJE time kupac. Kupac
 * postaje tek kroz postojeći tok kancelarije.
 */

/** Ključ za poređenje: samo za šifre od cifara; vodeće nule se uklanjaju. */
export function numericPartnerKey(raw) {
  const value = String(raw ?? "").trim();
  if (!/^\d{1,16}$/.test(value)) return null;
  return value.replace(/^0+(?=\d)/, "");
}

/**
 * Indeks šifarnika po ključu, sa evidencijom kolizija.
 *
 * @param {readonly { code: string, pib?: string | null }[]} entries
 */
export function buildPartnerRegister(entries) {
  const byKey = new Map();
  const byExact = new Map();
  for (const entry of entries) {
    const code = String(entry.code ?? "").trim();
    if (!code) continue;
    const pib = String(entry.pib ?? "").trim() || null;
    byExact.set(code, { code, pib });
    const key = numericPartnerKey(code);
    if (key === null) continue;
    const list = byKey.get(key) ?? [];
    list.push({ code, pib });
    byKey.set(key, list);
  }
  const collisions = [...byKey.values()].filter((list) => list.length > 1).length;
  return { byKey, byExact, collisions };
}

/**
 * Status: `confirmed` | `pib_mismatch` | `register_pib_missing` |
 * `invoice_pib_missing` | `ambiguous_code` | `not_in_register`.
 * Sve osim `confirmed` ide na ručni pregled.
 *
 * @param {{ code: string | null, pib: string | null }} invoice
 * @param {ReturnType<typeof buildPartnerRegister>} register
 */
export function confirmInvoicePartner(invoice, register) {
  const invoiceCode = String(invoice.code ?? "").trim() || null;
  const invoicePib = String(invoice.pib ?? "").trim() || null;
  const base = { invoiceCode, invoicePib, registerCode: null, matchedBy: null };
  if (!invoiceCode) return { ...base, status: "not_in_register" };

  // Kolizija ključa obara i tačno poklapanje: faktura uvek štampa šifru
  // dopunjenu nulama, pa „028" i „28" u šifarniku znače da oblik nije dokaz.
  const key = numericPartnerKey(invoiceCode);
  if (key !== null && (register.byKey.get(key) ?? []).length > 1) {
    return { ...base, status: "ambiguous_code", matchedBy: "numeric_key" };
  }

  let candidates;
  let matchedBy;
  const exact = register.byExact.get(invoiceCode);
  if (exact) {
    candidates = [exact];
    matchedBy = "exact";
  } else {
    candidates = key === null ? [] : (register.byKey.get(key) ?? []);
    matchedBy = "numeric_key";
  }

  if (candidates.length === 0) return { ...base, status: "not_in_register" };
  if (candidates.length > 1) return { ...base, status: "ambiguous_code", matchedBy };

  const [entry] = candidates;
  const found = { ...base, registerCode: entry.code, matchedBy };
  if (!entry.pib) return { ...found, status: "register_pib_missing" };
  if (!invoicePib) return { ...found, status: "invoice_pib_missing" };
  if (entry.pib !== invoicePib) return { ...found, status: "pib_mismatch" };
  return { ...found, status: "confirmed" };
}

/**
 * Broj cifara šifre partnera kako je štampaju BizniSoft fakture.
 *
 * Izmereno nad svim datiranim fakturama 2021–2026: šifra je UVEK 5 cifara sa
 * vodećim nulama, dok izvoz šifarnika nosi istu šifru bez nula.
 */
export const INVOICE_PARTNER_CODE_DIGITS = 5;

/**
 * Šifra iz šifarnika u obliku sa fakture („28" → „00028") — samo kada je to
 * nedvosmisleno: šifra od cifara, ne duža od 5, i njen ključ bez vodećih nula
 * jedinstven u celom šifarniku. Inače `null` (veza ide čoveku).
 *
 * @param {string} registerCode
 * @param {ReturnType<typeof buildPartnerRegister>} register
 */
export function invoiceFormPartnerCode(registerCode, register) {
  const code = String(registerCode ?? "").trim();
  if (!/^\d+$/.test(code) || code.length > INVOICE_PARTNER_CODE_DIGITS) return null;
  const key = numericPartnerKey(code);
  if ((register.byKey.get(key) ?? []).length !== 1) return null;
  return key.padStart(INVOICE_PARTNER_CODE_DIGITS, "0");
}
