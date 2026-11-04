import { unitNetCents } from "./money.mjs";

/**
 * Cene po kupcu — čista logika (bez baze): pamti se RABAT, cena se uvek izvodi.
 *
 *   cena kupca = važeća VP cena × (1 − rabat/100), zaokruženo kao BizniSoft (`money.mjs`).
 *
 * Unos konačne cene samo izračunava rabat; cena se nikad ne čuva kao fiksna. Rabat se čuva na
 * najviše 3 decimale (kao `price_rules.discount_percent` i faktura u BizniSoftu), pa se iz cene
 * bira NAJMANJI broj decimala koji ponovo daje tačno unetu cenu; kada to nije moguće, vraća se
 * najbliža cena koja iz rabata sledi i to se jasno prikazuje pre čuvanja.
 */

/** Podrazumevani rabat novog artikla iz uvoza VP cenovnika, za sve opcije plaćanja (odluka 16. 10. 2026). */
export const NEW_ARTICLE_DEFAULT_PERCENT = 30;
/** Interna obaveštenja o izmeni rabata se brišu posle ovoliko dana; pravila cena ostaju. */
export const NOTICE_RETENTION_DAYS = 10;
export const RULE_KINDS = Object.freeze(["redovni", "akcija"]);
export const MAX_DECIMALS = 3;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** „1.234,56“ / „1234,56“ / „1234.56“ → pare; prazno → null; neispravno → NaN. */
export function parseAmountCents(text) {
  const t = String(text ?? "").trim().replace(/\s| /g, "");
  if (t === "") return null;
  let normalized;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) || /^\d+(,\d{1,2})?$/.test(t)) normalized = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(\.\d{1,2})?$/.test(t)) normalized = t;
  else return Number.NaN;
  const [i, f = ""] = normalized.split(".");
  return Number(i) * 100 + Number(f.padEnd(2, "0"));
}

/** „22“ / „22,5“ / „22.125“ → broj (najviše 3 decimale); prazno → null; neispravno → NaN. */
export function parsePercent(text) {
  const t = String(text ?? "").trim().replace(/\s| |%/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Rabat u zapisu sa najviše 3 decimale (string koji `money.mjs` prihvata). */
export function percentString(p) {
  return String(Number(Number(p).toFixed(MAX_DECIMALS)));
}

/** Cena kupca u parama iz VP cene (pare) i rabata; `null` kada VP nedostaje ili je 0. */
export function priceFromRabat(baseCents, percent) {
  if (baseCents === null || baseCents === undefined || !(baseCents > 0)) return null;
  if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) return null;
  return unitNetCents((baseCents / 100).toFixed(2), percentString(percent));
}

/**
 * Rabat iz unete cene.
 * @returns {{ ok: true, percent: number, exact: boolean, priceCents: number } | { ok: false, reason: "nema_vp" | "iznad_vp" | "negativna" }}
 */
export function rabatFromPrice(baseCents, typedCents) {
  if (baseCents === null || baseCents === undefined || !(baseCents > 0)) return { ok: false, reason: "nema_vp" };
  if (!(typedCents >= 0)) return { ok: false, reason: "negativna" };
  if (typedCents > baseCents) return { ok: false, reason: "iznad_vp" };
  const raw = (1 - typedCents / baseCents) * 100;
  for (let d = 0; d <= MAX_DECIMALS; d++) {
    const p = Number(raw.toFixed(d));
    if (p >= 0 && p <= 100 && priceFromRabat(baseCents, p) === typedCents) return { ok: true, percent: p, exact: true, priceCents: typedCents };
  }
  // Nema tačnog rabata sa 3 decimale: najbliža cena (okolina od ±5 hiljaditih).
  let best = null;
  const center = Math.round(raw * 1000);
  for (let k = center - 5; k <= center + 5; k++) {
    const p = k / 1000;
    if (p < 0 || p > 100) continue;
    const c = priceFromRabat(baseCents, p);
    const diff = Math.abs(c - typedCents);
    if (!best || diff < best.diff) best = { p, c, diff };
  }
  return { ok: true, percent: best.p, exact: false, priceCents: best.c };
}

/**
 * Vrednost jedne izmene (rabat ili cena) na VP cenu dana važenja.
 * @param {{ field: "r" | "c", value: string }} edit
 * @param {number | null} baseCents
 * @param {{ replacesArticleAgreement?: boolean }} [ctx]
 * @returns {{ ok: true, percent: number, exact: boolean, priceCents: number | null, typedCents?: number } | { ok: false, error: string }}
 */
export function evaluateEdit(edit, baseCents, ctx = {}) {
  if (edit.field === "r") {
    const p = parsePercent(edit.value);
    if (p === null) return { ok: false, error: ctx.replacesArticleAgreement ? "Upišite rabat koji dalje važi — osnovni ili grupni rabat se ne vraća sam." : "Upišite rabat ili cenu." };
    if (Number.isNaN(p)) return { ok: false, error: "Rabat mora biti broj, npr. 22 ili 22,5 (najviše 3 decimale)." };
    if (p < 0 || p > 100) return { ok: false, error: "Rabat mora biti od 0 do 100 %." };
    return { ok: true, percent: p, exact: true, priceCents: priceFromRabat(baseCents, p) };
  }
  const c = parseAmountCents(edit.value);
  if (c === null) return { ok: false, error: ctx.replacesArticleAgreement ? "Upišite rabat koji dalje važi — osnovni ili grupni rabat se ne vraća sam." : "Upišite rabat ili cenu." };
  if (Number.isNaN(c)) return { ok: false, error: "Cena mora biti iznos, npr. 1.250,00." };
  const r = rabatFromPrice(baseCents, c);
  if (!r.ok) {
    return {
      ok: false,
      error: r.reason === "nema_vp" ? "Artikal nema VP cenu — rabat se ne može izračunati iz cene. Upišite rabat." : r.reason === "iznad_vp" ? "Cena je viša od VP cene (rabat bi bio negativan)." : "Cena ne sme biti negativna.",
    };
  }
  return { ok: true, percent: r.percent, exact: r.exact, priceCents: r.priceCents, typedCents: c };
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Period važenja izmene.
 * @param {{ kind: "sada" | "datum" | "akcija", from?: string | null, to?: string | null }} period
 * @param {string} today
 * @returns {{ ok: true, kind: "redovni" | "akcija", from: string, to: string | null } | { ok: false, error: string }}
 */
export function validatePeriod(period, today) {
  if (!ISO.test(today)) throw new Error("today mora biti YYYY-MM-DD");
  if (period.kind === "sada") return { ok: true, kind: "redovni", from: today, to: null };
  const from = period.from ?? "";
  if (!ISO.test(from)) return { ok: false, error: "Upišite datum početka (dd/mm/gggg)." };
  if (from < today) return { ok: false, error: "Početak ne može biti pre današnjeg dana." };
  if (from > addDays(today, 366)) return { ok: false, error: "Početak je više od godinu dana unapred." };
  if (period.kind === "datum") return { ok: true, kind: "redovni", from, to: null };
  if (period.kind !== "akcija") return { ok: false, error: "Nepoznato važenje." };
  const to = period.to ?? "";
  if (!ISO.test(to)) return { ok: false, error: "Akcija mora imati kraj (dd/mm/gggg)." };
  if (to < from) return { ok: false, error: "Kraj akcije je pre početka." };
  if (to > addDays(from, 366)) return { ok: false, error: "Akcija može trajati najviše godinu dana." };
  return { ok: true, kind: "akcija", from, to };
}

const overlaps = (a, from, to) => a.effectiveFrom <= (to ?? "9999-12-31") && from <= (a.effectiveTo ?? "9999-12-31");

/**
 * @typedef {{ id: string, ruleKind: string, effectiveFrom: string, effectiveTo: string | null, discountPercent?: string | null }} ScopeRule
 */

/**
 * Postojeće akcije istog opsega koje se preklapaju sa novim periodom.
 * @param {ScopeRule[]} existing @param {string} from @param {string | null} to
 * @returns {ScopeRule[]}
 */
export function promoConflicts(existing, from, to) {
  return existing.filter((r) => r.ruleKind === "akcija" && overlaps(r, from, to));
}

/**
 * Šta se radi sa postojećim pravilima ISTOG opsega (kupac + artikal + opcija) pri čuvanju.
 *  - redovni rabat od `from`: prethodni redovni se zatvara dan ranije; budući (od >= from) se opoziva.
 *    Akcije se ne diraju — redovni rabat posle akcije je upravo novi redovni.
 *  - akcija `from`–`to`: postojeća akcija koja se preklapa se skraćuje do dana pre nove (ili opoziva ako
 *    počinje istog ili kasnijeg dana) — SAMO uz izričitu potvrdu (`replaceConfirmed`). Redovni se ne dira.
 * @param {ScopeRule[]} existing @param {"redovni" | "akcija"} kind @param {string} from @param {string | null} to @param {boolean} replaceConfirmed
 * @returns {{ ok: true, changes: { id: string, action: "close" | "revoke", effectiveTo?: string }[] } | { ok: false, error: string, conflicts: ScopeRule[] }}
 */
export function planReplacement(existing, kind, from, to, replaceConfirmed) {
  const changes = [];
  if (kind === "redovni") {
    for (const r of existing) {
      if (r.ruleKind === "akcija") continue;
      if (r.effectiveTo && r.effectiveTo < from) continue;
      if (r.effectiveFrom >= from) changes.push({ id: r.id, action: "revoke" });
      else changes.push({ id: r.id, action: "close", effectiveTo: addDays(from, -1) });
    }
    return { ok: true, changes };
  }
  const conflicts = promoConflicts(existing, from, to);
  if (conflicts.length && !replaceConfirmed) return { ok: false, error: "Preklapanje sa postojećom akcijom — potvrdite zamenu.", conflicts };
  for (const r of conflicts) {
    if (r.effectiveFrom >= from) changes.push({ id: r.id, action: "revoke" });
    else changes.push({ id: r.id, action: "close", effectiveTo: addDays(from, -1) });
  }
  return { ok: true, changes };
}

/**
 * Nov artikal (0057): podrazumevani rabat važi kada za SAM artikal ne postoji pravilo
 * (kupac/grupa/svi + artikal). Šire pravilo (osnovni rabat kupca, grupa proizvoda, proizvođač) ga ne
 * nadjačava; izričit dogovor za artikal uvek ima prednost.
 * @param {{ winner: any, considered: any[], conflict: any[], exceptionReview?: boolean }} decision
 * @param {number | null | undefined} defaultPercent
 * @returns {any}
 */
export function withNewArticleDefault(decision, defaultPercent) {
  if (defaultPercent === null || defaultPercent === undefined) return decision;
  if ((decision.considered ?? []).some((r) => r.productScope === "article")) return decision;
  const winner = { valueKind: "discount_percent", discountPercent: String(defaultPercent), productScope: "article", source: "novi_artikal", ruleKind: "redovni", effectiveFrom: null, effectiveTo: null };
  return { ...decision, winner, level: null, levelLabel: "Nov artikal — podrazumevani rabat", conflict: [], exceptionReview: false, newArticleDefault: true, reason: `Nov artikal: podrazumevani rabat ${defaultPercent} % dok se ne dogovori drugačije.` };
}

/**
 * Primaoci internog obaveštenja. Kupac NIKAD nije primalac.
 *  - izmenu komercijaliste dobijaju svi aktivni gazde;
 *  - gazdinu izmenu dobijaju komercijalisti dodeljeni kupcu (nijedan → niko).
 * @param {{ id: string, role: string }} actor
 * @param {{ id: string }[]} owners
 * @param {{ id: string }[]} assignedReps
 */
export function noticeRecipients(actor, owners, assignedReps) {
  const list = actor.role === "komercijalista" ? owners : actor.role === "gazda" ? assignedReps : [];
  return [...new Set(list.map((u) => u.id))].filter((id) => id !== actor.id);
}

/** Tekst perioda za obaveštenje i pregled. */
export function periodText(kind, from, to, today, dmy) {
  if (kind === "akcija") return `akcija ${dmy(from)}–${dmy(to)}, zatim se vraća redovni rabat`;
  return from === today ? "od danas, bez isteka" : `od ${dmy(from)}, bez isteka`;
}
