import { unitNetCents } from "./money.mjs";

/**
 * Konačna cena kupca iz osnovne cene i odobrenog rabata — JEDINO mesto koje
 * odlučuje da li kupac vidi cenu ili „cenu na upit“.
 *
 * Pravilo: puna osnovna (VP) cena se NIKAD ne prikazuje kao dogovorena cena
 * kupca samo zato što rabat nije pronađen.
 *   - potvrđen rabat (uključujući izričito 0 %) ili fiksna neto cena → cena;
 *   - nema pravila za par kupac–artikal → na upit (`rabat_nepoznat`);
 *   - pravila u sukobu → na upit (`rabat_u_sukobu`);
 *   - rabat postoji, ali nema osnovne cene → na upit (`nema_osnovne_cene`).
 * Na upit ide nadležnom komercijalisti (dodela kupca), ne kao greška.
 *
 * Čista logika: ulaz je odluka `evaluatePricing` i osnovna cena u stotim delovima.
 * Neto jedinična cena se računa kao BizniSoft (`money.mjs`, polovina pare naniže).
 */

export const ON_REQUEST_MESSAGES = Object.freeze({
  rabat_nepoznat: "Cena na upit: Vaš rabat za ovaj artikal još nije potvrđen.",
  rabat_u_sukobu: "Cena na upit: uslovi za ovaj artikal se proveravaju.",
  nema_osnovne_cene: "Cena na upit: artikal još nema važeću cenu u cenovniku.",
});

/**
 * @param {{ winner: null | { valueKind: string, discountPercent?: string | number | null, netPrice?: string | number | null }, conflict: unknown[] }} decision
 * @param {number | null} baseCents  važeća osnovna cena (bez PDV-a) u stotim delovima
 * @returns {{ status: "cena", baseCents: number | null, discountPercent: number | null, netCents: number, basis: string }
 *         | { status: "na_upit", reason: keyof typeof ON_REQUEST_MESSAGES, message: string }}
 */
export function resolveCustomerPrice(decision, baseCents) {
  const naUpit = (reason) => ({ status: /** @type {const} */ ("na_upit"), reason, message: ON_REQUEST_MESSAGES[reason] });
  if (decision.conflict && decision.conflict.length > 0) return naUpit("rabat_u_sukobu");
  const w = decision.winner;
  if (!w) return naUpit("rabat_nepoznat");
  if (w.valueKind === "net_price") {
    const net = Math.round(Number(w.netPrice) * 100);
    if (!Number.isFinite(net) || net < 0) return naUpit("rabat_u_sukobu");
    return { status: "cena", baseCents: baseCents ?? null, discountPercent: null, netCents: net, basis: "fiksna neto cena iz dogovora" };
  }
  const pct = Number(w.discountPercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return naUpit("rabat_u_sukobu");
  if (baseCents === null || baseCents === undefined || baseCents <= 0) return naUpit("nema_osnovne_cene");
  return {
    status: "cena",
    baseCents,
    discountPercent: pct,
    netCents: unitNetCents((baseCents / 100).toFixed(2), String(pct)),
    basis: pct === 0 ? "osnovna cena, ugovoreni rabat 0 %" : `osnovna cena − ugovoreni rabat ${pct} %`,
  };
}
