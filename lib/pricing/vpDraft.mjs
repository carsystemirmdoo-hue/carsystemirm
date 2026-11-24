/**
 * Priprema novog VP cenovnika (2026-11-18) — čista logika, bez baze.
 *
 *   1. promena po brendu, grupi ili artiklu u PROCENTIMA (+4, -2,5) ili tačna nova cena artikla;
 *      prednost: tačna cena › procenat artikla › procenat grupe › procenat brenda;
 *   2. nova cena = stara × (1 + p/100), zaokružena na paru ili na ceo dinar;
 *   3. čitanje Excela: kolona „Šifra“ i „Nova VP“ (ili „VP cena“ kada nove kolone nema).
 *
 * Raspored brend › grupa › artikal je isti kao u tabeli rabata (`groupKeysFor`), a naziv brenda
 * isti kao na Lager listi i u Analitici (`brandOf`).
 */

/** Najmanja i najveća promena u jednom koraku (zaštita od kucanja „40“ umesto „4“ ostaje na ekranu). */
export const MIN_CHANGE_PERCENT = -90;
export const MAX_CHANGE_PERCENT = 300;
/** Promena veća od ovoga se na ekranu i kod kancelarije ističe. */
export const LARGE_CHANGE_PERCENT = 20;

/**
 * Broj iz polja ili Excela: „1.250,50“, „1250,5“, „1250.50“, „+4“, „-2,5“.
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value ?? "").trim().replace(/\s| /g, "").replace(/%$/, "");
  if (!s) return null;
  let sign = 1;
  if (s[0] === "+" || s[0] === "-" || s[0] === "−") {
    if (s[0] !== "+") sign = -1;
    s = s.slice(1);
  }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s) * sign;
  return Number.isFinite(n) ? n : null;
}

/** Procenat promene: -90 do +300, najviše 2 decimale. */
export function parseChangePercent(value) {
  const n = parseNumber(value);
  if (n === null || n < MIN_CHANGE_PERCENT || n > MAX_CHANGE_PERCENT) return null;
  return Math.round(n * 100) / 100;
}

/** Cena u parama iz polja/Excela; mora biti pozitivna. */
export function parsePriceCents(value) {
  const n = parseNumber(value);
  if (n === null || n <= 0 || n > 1e10) return null;
  return Math.round(n * 100);
}

/**
 * @param {number} oldCents
 * @param {number} percent
 * @param {"para" | "dinar"} [rounding]
 */
export function newCentsFor(oldCents, percent, rounding = "para") {
  const raw = oldCents * (1 + percent / 100);
  const cents = rounding === "dinar" ? Math.round(raw / 100) * 100 : Math.round(raw);
  return Math.max(cents, rounding === "dinar" ? 100 : 1);
}

/** Promena u procentima, na jednu decimalu (za prikaz i Excel). */
export function changePercent(oldCents, newCents) {
  if (!oldCents) return null;
  return Math.round((newCents / oldCents - 1) * 1000) / 10;
}

/**
 * @typedef {{ articleId: string, brand: string, group: string, oldCents: number | null }} DraftBaseRow
 * @typedef {{ brands?: Record<string, number>, groups?: Record<string, number>, articles?: Record<string, number>, prices?: Record<string, number> }} DraftEdits
 */

/**
 * Izmene → nova cena po artiklu. Vraća SAMO artikle čija se cena menja.
 * Artikal bez stare cene dobija novu samo iz tačne cene (procenat od ničega ne postoji).
 *
 * @param {DraftBaseRow[]} rows
 * @param {DraftEdits} edits
 * @param {"para" | "dinar"} [rounding]
 * @returns {{ items: { articleId: string, oldCents: number | null, newCents: number, origin: string }[], ignored: { articleId: string, reason: string }[] }}
 */
export function planDraft(rows, edits, rounding = "para") {
  const brands = edits.brands ?? {};
  const groups = edits.groups ?? {};
  const articles = edits.articles ?? {};
  const prices = edits.prices ?? {};
  const items = [];
  const ignored = [];
  for (const r of rows) {
    let newCents = null;
    let origin = null;
    if (prices[r.articleId] !== undefined) {
      newCents = prices[r.articleId];
      origin = "cena";
    } else {
      const pct =
        articles[r.articleId] !== undefined
          ? [articles[r.articleId], "artikal"]
          : groups[r.group] !== undefined
            ? [groups[r.group], `grupa ${r.group}`]
            : brands[r.brand] !== undefined
              ? [brands[r.brand], `brend ${r.brand}`]
              : null;
      if (!pct) continue;
      if (r.oldCents === null) {
        ignored.push({ articleId: r.articleId, reason: "nema važeću VP cenu — upišite tačnu cenu" });
        continue;
      }
      newCents = newCentsFor(r.oldCents, pct[0], rounding);
      origin = pct[1];
    }
    if (!Number.isInteger(newCents) || newCents <= 0) {
      ignored.push({ articleId: r.articleId, reason: "neispravna cena" });
      continue;
    }
    if (newCents === r.oldCents) continue;
    items.push({ articleId: r.articleId, oldCents: r.oldCents, newCents, origin });
  }
  return { items, ignored };
}

/**
 * Proverava i čisti izmene iz pregledača (server im ne veruje slepo).
 * @param {unknown} raw
 * @returns {DraftEdits}
 */
export function sanitizeEdits(raw) {
  const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const pctMap = (v) => {
    /** @type {Record<string, number>} */
    const out = {};
    if (!v || typeof v !== "object") return out;
    for (const [k, x] of Object.entries(v).slice(0, 5000)) {
      const p = parseChangePercent(x);
      if (p !== null && typeof k === "string" && k.length <= 160) out[k] = p;
    }
    return out;
  };
  /** @type {Record<string, number>} */
  const prices = {};
  if (src.prices && typeof src.prices === "object") {
    for (const [k, x] of Object.entries(src.prices).slice(0, 5000)) {
      if (/^[0-9a-f-]{36}$/i.test(k) && Number.isInteger(x) && /** @type {number} */ (x) > 0 && /** @type {number} */ (x) < 1e12) prices[k] = /** @type {number} */ (x);
    }
  }
  return { brands: pctMap(src.brands), groups: pctMap(src.groups), articles: pctMap(src.articles), prices };
}

const fold = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Excel → nove cene po šifri. Zaglavlje se traži u prvih 15 redova: kolona sa „šifra“ i kolona
 * „nova vp“ (ili „nova cena“); bez nje — „vp cena“ / „vp“. Prazna nova cena = artikal se ne menja.
 *
 * @param {Array<Array<unknown>>} sheet
 * @returns {{ ok: true, rows: { code: string, cents: number, line: number }[], problems: { line: number, text: string }[], priceColumn: string } | { ok: false, error: string }}
 */
export function parseDraftSheet(sheet) {
  for (let h = 0; h < Math.min(15, sheet.length); h += 1) {
    const head = (sheet[h] ?? []).map(fold);
    const codeCol = head.findIndex((c) => c === "sifra" || c.startsWith("sifra "));
    if (codeCol < 0) continue;
    let priceCol = head.findIndex((c) => c.startsWith("nova vp") || c.startsWith("nova cena"));
    if (priceCol < 0) priceCol = head.findIndex((c) => c === "vp" || c.startsWith("vp cena"));
    if (priceCol < 0) return { ok: false, error: "U zaglavlju nema kolone „Nova VP“ (ili „VP cena“)." };
    const rows = [];
    const problems = [];
    const seen = new Map();
    for (let i = h + 1; i < sheet.length; i += 1) {
      const line = i + 1;
      const r = sheet[i] ?? [];
      const code = String(r[codeCol] ?? "").trim();
      const priceRaw = r[priceCol];
      if (!code && (priceRaw === null || priceRaw === undefined || String(priceRaw).trim() === "")) continue;
      if (!code) {
        problems.push({ line, text: "cena bez šifre" });
        continue;
      }
      if (!/^[0-9A-Za-z./_-]{1,32}$/.test(code)) {
        problems.push({ line, text: `neispravna šifra „${code.slice(0, 40)}“` });
        continue;
      }
      if (priceRaw === null || priceRaw === undefined || String(priceRaw).trim() === "") continue;
      const cents = parsePriceCents(priceRaw);
      if (cents === null) {
        problems.push({ line, text: `${code}: neispravna cena „${String(priceRaw).slice(0, 30)}“` });
        continue;
      }
      if (seen.has(code)) {
        problems.push({ line, text: `${code}: šifra se ponavlja (prvi put u redu ${seen.get(code)}) — nijedan red te šifre se ne uzima` });
        continue;
      }
      seen.set(code, line);
      rows.push({ code, cents, line });
    }
    const dup = new Set(problems.filter((p) => p.text.includes("ponavlja")).map((p) => p.text.split(":")[0]));
    return { ok: true, rows: rows.filter((r) => !dup.has(r.code)), problems, priceColumn: String(sheet[h][priceCol] ?? "") };
  }
  return { ok: false, error: "Nije pronađeno zaglavlje sa kolonom „Šifra“. Koristite Excel preuzet sa ove strane." };
}
