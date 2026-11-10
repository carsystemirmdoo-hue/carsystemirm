/**
 * Tabela rabata kupca (2026-11-09) — čista logika, bez baze.
 *
 * Tri stvari, odvojene od ekrana da bi se mogle proveriti testom:
 *   1. hijerarhija brend › grupa › artikal (iz potvrđenog brenda ili naziva);
 *   2. obrnuti račun: upisana NETO cena → rabat koji na BizniSoft fakturi daje
 *      tačno tu cenu (rabat na 3 decimale, pola pare naniže — `money.mjs`);
 *   3. pretvaranje izmena (brend, grupa, artikal, izabrani, neto) u promene po
 *      artiklu, uz posebne dogovore koji ostaju i artikle koji se ne smeju menjati.
 *
 * Sve izmene na kraju postaju pravila po ARTIKLU (isti put kao „Promena rabata“),
 * pa nema novog pravila prvenstva ni nove vrste pravila.
 */

import { unitNetCents } from "./money.mjs";
import { familyCandidates } from "./rebateCoverage.mjs";

/** Najviše artikala u jednom čuvanju (svaki je jedno pravilo i jedan zapis traga). */
export const MAX_ITEMS_PER_SAVE = 400;
const EPS = 0.0005;
export const samePercent = (a, b) => a !== null && b !== null && a !== undefined && b !== undefined && Math.abs(a - b) < EPS;

/**
 * Brend i grupa artikla. Potvrđen brend (`articles.brand`, potvrdio vlasnik)
 * ima prednost nad predlogom iz naziva.
 *
 * @param {{ name: string, brand?: string | null }} article
 * @returns {{ brand: string, group: string }}
 */
export function groupKeysFor(article) {
  const c = familyCandidates(article.name);
  let brand;
  let group;
  if (c.length >= 2) [brand, group] = c;
  else if (c.length === 1 && !c[0].includes(" ")) brand = group = c[0];
  else if (c.length === 1) {
    brand = c[0].split(" ")[0];
    group = c[0];
  } else brand = group = "OSTALO";
  if (article.brand && article.brand !== brand) {
    brand = article.brand;
    if (!group.startsWith(`${brand} `)) group = `${brand} · ${group}`;
  }
  return { brand, group };
}

/** Rabat (do 3 decimale) kao tekst za `money.mjs`. */
function pctText(p) {
  return (Math.round(p * 1000) / 1000).toFixed(3);
}

/** Neto jedinična cena u parama za osnovnu cenu (pare) i rabat — kao faktura. */
export function netCentsFor(baseCents, percent) {
  return unitNetCents((baseCents / 100).toFixed(2), pctText(percent));
}

/**
 * Upisana neto cena → rabat koji na fakturi daje TAČNO tu cenu.
 *
 * Rabat ima 3 decimale, pa kod skupljih artikala ne postoji rabat za svaku
 * paru. Tada se vraća NAJBLIŽA moguća cena (`exact: false`) — nikad se ne
 * zaokružuje tiho; ekran mora reći korisniku šta će zaista važiti.
 *
 * @param {number | null} baseCents osnovna (VP) cena u parama
 * @param {number} wantCents        upisana neto cena u parama
 * @returns {{ ok: true, percent: number, netCents: number, exact: boolean } | { ok: false, error: string }}
 */
export function rebateForNet(baseCents, wantCents) {
  if (!Number.isInteger(baseCents) || baseCents <= 0) return { ok: false, error: "Artikal nema važeću VP cenu; neto cenu nije moguće preračunati." };
  if (!Number.isInteger(wantCents) || wantCents <= 0) return { ok: false, error: "Neto cena mora biti veća od nule." };
  if (wantCents > baseCents) return { ok: false, error: "Neto cena je veća od VP cene — to nije rabat." };
  const R0 = Math.round((1 - wantCents / baseCents) * 100000); // hiljaditi delovi procenta
  /** @type {{ R: number, got: number, diff: number } | null} */
  let best = null;
  for (let R = Math.max(0, R0 - 6); R <= Math.min(100000, R0 + 6); R += 1) {
    const got = netCentsFor(baseCents, R / 1000);
    const diff = Math.abs(got - wantCents);
    if (!best || diff < best.diff || (diff === best.diff && Math.abs(R - R0) < Math.abs(best.R - R0))) best = { R, got, diff };
  }
  if (!best) return { ok: false, error: "Rabat nije moguće izračunati." };
  return { ok: true, percent: best.R / 1000, netCents: best.got, exact: best.diff === 0 };
}

/**
 * Tekst iz polja (srpski zapis) → broj. „1.800,50“, „1800,5“, „1800.5“ → 1800.5.
 * Prazno ili neispravno → null.
 *
 * @param {unknown} value
 */
export function parseAmount(value) {
  let s = String(value ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Rabat iz polja: 0–99,999 sa najviše 3 decimale. */
export function parsePercent(value) {
  const n = parseAmount(value);
  if (n === null || n < 0 || n >= 100) return null;
  return Math.round(n * 1000) / 1000;
}

/** Najčešći važeći rabat u skupu (osnov grupe); bez rabata → null. */
export function dominantPercent(rows) {
  const counts = new Map();
  for (const r of rows) if (r.currentPercent !== null) counts.set(r.currentPercent, (counts.get(r.currentPercent) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return sorted.length ? sorted[0][0] : null;
}

/**
 * @typedef {object} TableRow
 * @property {string} articleId
 * @property {string} brand
 * @property {string} group
 * @property {number | null} baseCents
 * @property {number | null} currentPercent  važeći rabat (null = cena na upit)
 * @property {"artikal"|"sire"|null} source  „artikal“ = važi pravilo tog artikla; „sire“ = brend/kupac/grupa kupaca; null = na upit
 * @property {string | null} ownRuleId       važeće pravilo ARTIKLA (koje promena zamenjuje)
 * @property {string | null} blocked          razlog zbog kog se artikal sada ne menja
 * @property {string[]} [pairOf]              poklopac obaveznog para (0056): posude koje zatvara — rabat se ne bira posebno, ide uz posudu
 */

/**
 * Izmene sa ekrana → promene po artiklu.
 *
 * Prvenstvo: neto cena artikla > rabat artikla > grupa > brend. Grupna i
 * brend izmena NE diraju poseban dogovor (pravilo artikla čiji rabat nije
 * osnov grupe), osim ako je korisnik izričito uključi.
 *
 * @param {TableRow[]} rows
 * @param {{ brands?: Record<string, number>, groups?: Record<string, number>, articles?: Record<string, number>, nets?: Record<string, number>, includeOwn?: boolean }} edits
 *   brands/groups/articles: rabat u %; nets: neto cena u parama
 */
export function planChanges(rows, edits) {
  const brands = edits.brands ?? {};
  const groups = edits.groups ?? {};
  const articles = edits.articles ?? {};
  const nets = edits.nets ?? {};
  const dominantByGroup = new Map();
  const dominantByBrand = new Map();
  const byGroup = new Map();
  const byBrand = new Map();
  for (const r of rows) {
    byGroup.set(r.group, [...(byGroup.get(r.group) ?? []), r]);
    byBrand.set(r.brand, [...(byBrand.get(r.brand) ?? []), r]);
  }
  for (const [k, list] of byGroup) dominantByGroup.set(k, dominantPercent(list));
  for (const [k, list] of byBrand) dominantByBrand.set(k, dominantPercent(list));

  /** @type {{ articleId: string, percent: number, origin: string, netCents: number | null, replacesRuleId: string | null, from: number | null }[]} */
  const items = [];
  /** @type {{ articleId: string, reason: string, origin: string }[]} */
  const skipped = [];
  /** @type {{ articleId: string, origin: string, percent: number }[]} */
  const kept = [];

  for (const r of rows) {
    if (r.pairOf?.length) continue; // poklopac: posle petlje, uz svoju posudu
    let percent = null;
    let origin = null;
    let netCents = null;
    let wide = false;
    if (nets[r.articleId] !== undefined) {
      const d = rebateForNet(r.baseCents, nets[r.articleId]);
      if (!d.ok) {
        skipped.push({ articleId: r.articleId, reason: d.error, origin: "neto cena" });
        continue;
      }
      percent = d.percent;
      netCents = d.netCents;
      origin = "neto cena";
    } else if (articles[r.articleId] !== undefined) {
      percent = articles[r.articleId];
      origin = "artikal";
    } else if (groups[r.group] !== undefined) {
      percent = groups[r.group];
      origin = `grupa ${r.group}`;
      wide = true;
    } else if (brands[r.brand] !== undefined) {
      percent = brands[r.brand];
      origin = `brend ${r.brand}`;
      wide = true;
    }
    if (percent === null || origin === null) continue;
    if (wide && !edits.includeOwn && r.source === "artikal" && r.ownRuleId) {
      const base = origin.startsWith("grupa") ? dominantByGroup.get(r.group) : dominantByBrand.get(r.brand);
      if (!samePercent(r.currentPercent, base ?? null)) {
        kept.push({ articleId: r.articleId, origin, percent: r.currentPercent ?? 0 });
        continue;
      }
    }
    if (r.blocked) {
      skipped.push({ articleId: r.articleId, reason: r.blocked, origin });
      continue;
    }
    if (samePercent(r.currentPercent, percent) && r.source === "artikal") continue; // isti rabat već važi
    items.push({ articleId: r.articleId, percent, origin, netCents, replacesRuleId: r.ownRuleId, from: r.currentPercent });
  }

  /*
   * Obavezan par (0056, odluka vlasnika): blanko posuda i poklopac se prodaju samo zajedno, pa
   * poklopac dobija ISTI rabat kao posuda koju zatvara — nikad poseban. Kad jedan poklopac zatvara
   * više posuda (stara i nova šifra), sve promenjene moraju imati isti rabat.
   */
  const byId = new Map(items.map((i) => [i.articleId, i]));
  for (const r of rows) {
    if (!r.pairOf?.length) continue;
    const changed = r.pairOf.map((id) => byId.get(id)).filter((i) => i !== undefined);
    if (!changed.length) continue;
    const percent = changed[0].percent;
    const origin = "uz posudu (obavezan par)";
    if (changed.some((i) => !samePercent(i.percent, percent))) {
      skipped.push({ articleId: r.articleId, reason: "posude ovog poklopca dobijaju različit rabat — upišite isti rabat za sve", origin });
      continue;
    }
    if (r.blocked) {
      skipped.push({ articleId: r.articleId, reason: r.blocked, origin });
      continue;
    }
    if (samePercent(r.currentPercent, percent) && r.source === "artikal") continue;
    items.push({ articleId: r.articleId, percent, origin, netCents: null, replacesRuleId: r.ownRuleId, from: r.currentPercent });
  }
  return { items, skipped, kept, tooMany: items.length > MAX_ITEMS_PER_SAVE };
}
