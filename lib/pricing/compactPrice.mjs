/**
 * Sažet prikaz cene kupca (kartice kataloga, „Za Vas“): dve cene u jednom
 * redu, uvek odloženo pa avans, i jedna linija sa nazivima opcija, pakovanjem
 * i PDV napomenom.
 *
 *   4.061 / 3.668 RSD
 *   Odloženo / Avans · kanta 5 L · bez PDV-a
 *
 * Iznosi zadržavaju stvarne decimale; ceo dinar se prikazuje bez „,00“.
 * Rok odloženog plaćanja se ovde ne navodi (puni naziv opcije ostaje u korpi i
 * na stranici proizvoda).
 */

const whole = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 4061 → „4.061“, 3667.5 → „3.667,50“. */
export function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const cents = Math.round(n * 100);
  return cents % 100 === 0 ? whole.format(cents / 100) : decimal.format(cents / 100);
}

/** Kratak naziv opcije plaćanja za sažet prikaz. */
export function shortOptionLabel(code) {
  if (code === "avans") return "Avans";
  if (/^odlozeno_\d{1,3}$/.test(String(code ?? ""))) return "Odloženo";
  return null;
}

function optionRank(code) {
  if (code === "avans") return 9999;
  const m = String(code ?? "").match(/^odlozeno_(\d{1,3})$/);
  return m ? Number(m[1]) : -1;
}

/**
 * @param {{ code: string | null, net: number }[]} prices cene ISTOG pakovanja po opciji
 * @param {{ pack?: string | null, from?: boolean }} [extra]
 * @returns {{ amounts: string, labels: string | null, detail: string } | null}
 */
export function compactPrice(prices, extra = {}) {
  const rows = prices
    .filter((p) => Number.isFinite(Number(p.net)) && Number(p.net) > 0)
    .sort((a, b) => optionRank(a.code) - optionRank(b.code));
  if (rows.length === 0) return null;
  const amounts = `${extra.from ? "od " : ""}${rows.map((r) => formatAmount(r.net)).join(" / ")} RSD`;
  const named = rows.map((r) => shortOptionLabel(r.code));
  const labels = rows.length > 1 && named.every(Boolean) ? named.join(" / ") : null;
  const detail = [labels, extra.pack || null, "bez PDV-a"].filter(Boolean).join(" · ");
  return { amounts, labels, detail };
}
