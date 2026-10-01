/**
 * Kanonski parametar filtera po brendu je `brend` (srpska latinica, kao i ostali
 * parametri kataloga). Stari `brand` ostaje kao alias radi starih linkova, ali ne
 * sme da napravi zasebnu adresu: middleware ga trajno (308) preusmerava na isti
 * URL sa `brend`, pa varijanta sa `brand` nikad ne dobije sopstveni odgovor.
 *
 * Bez Node zavisnosti — uvozi ga Edge middleware.
 */

const BRAND_FILTER_PATHS = [/^\/katalog$/, /^\/katalog\/strana\/\d+$/, /^\/katalozi$/];

/**
 * @param {string} pathname
 * @param {URLSearchParams} searchParams
 * @returns {string | null} nova query niska (bez „?") ili null kad preusmerenje nije potrebno
 */
export function brandAliasSearch(pathname, searchParams) {
  if (!searchParams.has("brand")) return null;
  if (!BRAND_FILTER_PATHS.some((pattern) => pattern.test(pathname))) return null;
  const next = new URLSearchParams();
  const alias = searchParams.get("brand") ?? "";
  for (const [key, value] of searchParams) {
    if (key === "brand") continue;
    next.append(key, value);
  }
  // Ako su prisutna oba, važi kanonski `brend` (kao u CatalogExplorer-u).
  if (!next.has("brend") && alias) next.set("brend", alias);
  return next.toString();
}
