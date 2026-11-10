/**
 * Preporuke kupca i ponuda (2026-11-10) — čista logika, bez baze.
 *
 *   1. razlozi „Ne uzima više“ (ključ u bazi → tekst na ekranu) i provera unosa;
 *   2. stavke ponude: izabrani artikli + obavezni poklopci (0056) u istoj količini,
 *      cena po važećim uslovima kupca na dan ponude.
 */

/** Razlozi (redosled = redosled na ekranu). Ključevi su isti kao CHECK u 0060. */
export const DISMISS_REASONS = /** @type {const} */ ([
  ["drugi_dobavljac", "Kupuje kod drugog dobavljača"],
  ["drugi_brend", "Prešao na drugi brend"],
  ["zamenjen", "Zamenjen našim drugim artiklom"],
  ["ne_radi_posao", "Više ne radi taj posao"],
  ["cena", "Cena"],
  ["drugo", "Drugo"],
]);

/** @param {string} key */
export function dismissReasonLabel(key) {
  return DISMISS_REASONS.find(([k]) => k === key)?.[1] ?? key;
}

/**
 * Provera unosa „Ne uzima više“ — ista pravila kao CHECK u bazi, sa porukom za ekran.
 *
 * @param {{ articleCode?: unknown, reason?: unknown, replacementCode?: unknown, note?: unknown }} input
 * @returns {{ ok: true, value: { articleCode: string, reason: string, replacementCode: string | null, note: string | null } } | { ok: false, error: string }}
 */
export function parseDismissal(input) {
  const articleCode = String(input.articleCode ?? "").trim();
  const reason = String(input.reason ?? "");
  const replacementCode = String(input.replacementCode ?? "").trim() || null;
  const note = String(input.note ?? "").trim() || null;
  if (!articleCode || articleCode.length > 80) return { ok: false, error: "Artikal nije ispravan." };
  if (!DISMISS_REASONS.some(([k]) => k === reason)) return { ok: false, error: "Izaberite razlog." };
  if (reason === "zamenjen" && !replacementCode) return { ok: false, error: "Izaberite artikal kojim je zamenjen." };
  if (reason === "zamenjen" && replacementCode === articleCode) return { ok: false, error: "Artikal ne može zameniti sam sebe." };
  if (reason === "drugo" && (!note || note.length < 3)) return { ok: false, error: "Za „Drugo“ upišite kratku napomenu." };
  if (note && note.length > 500) return { ok: false, error: "Napomena može imati najviše 500 znakova." };
  return { ok: true, value: { articleCode, reason, replacementCode: reason === "zamenjen" ? replacementCode : null, note } };
}

/**
 * Stavke ponude.
 *
 * Količina = poslednja kupljena količina (komercijalista je menja u fajlu). Poklopac obaveznog
 * para dolazi uz posudu u ZBIRU količina svih izabranih posuda koje zatvara — kao u korpi.
 * Artikal bez cene ide u ponudu sa „na upit“, nikad sa izmišljenom cenom.
 *
 * @typedef {{ code: string, name: string, unit: string | null, quantity: number,
 *   price: { baseCents: number, discountPercent: number | null, netCents: number } | null }} OfferItem
 * @param {OfferItem[]} chosen  izabrani artikli (redosled sa ekrana)
 * @param {{ containerCode: string, lid: OfferItem }[]} pairs  obavezni parovi po šifri posude
 * @returns {{ lines: (OfferItem & { lid: boolean, amountCents: number | null })[], totalCents: number, priceless: number }}
 */
export function offerLines(chosen, pairs) {
  /** @type {(OfferItem & { lid: boolean, amountCents: number | null })[]} */
  const lines = [];
  const lidQty = new Map();
  const lidItem = new Map();
  const chosenCodes = new Set(chosen.map((c) => c.code));
  for (const c of chosen) {
    lines.push({ ...c, lid: false, amountCents: c.price ? c.price.netCents * c.quantity : null });
    for (const p of pairs) {
      if (p.containerCode !== c.code || chosenCodes.has(p.lid.code)) continue;
      lidQty.set(p.lid.code, (lidQty.get(p.lid.code) ?? 0) + c.quantity);
      lidItem.set(p.lid.code, p.lid);
    }
  }
  for (const [code, qty] of lidQty) {
    const lid = lidItem.get(code);
    lines.push({ ...lid, quantity: qty, lid: true, amountCents: lid.price ? lid.price.netCents * qty : null });
  }
  return {
    lines,
    totalCents: lines.reduce((s, l) => s + (l.amountCents ?? 0), 0),
    priceless: lines.filter((l) => l.amountCents === null).length,
  };
}

/** Bezbedan deo naziva fajla iz naziva kupca. */
export function fileSlug(name) {
  return (
    String(name)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "dj")
      .replace(/Đ/g, "Dj")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "kupac"
  );
}
