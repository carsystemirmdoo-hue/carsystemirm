/**
 * Podrazumevana granica za DETALJNE stavke (`loadSalesLines`).
 *
 * Zbirovi, broj faktura i agregati po kupcu/artiklu se NE računaju iz ovih
 * stavki — za njih postoje `loadSalesSummary` i `loadSalesBreakdown`, koji
 * rade nad celim filtriranim skupom u bazi. Ekrani stavke prikazuju samo kao
 * listu (najviše `SALES_LINES_DISPLAY` redova).
 */
export const SALES_LINES_LIMIT = 20000;
