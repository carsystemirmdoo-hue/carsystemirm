import "server-only";

/**
 * Feature gate preporuka.
 *
 * Podrazumevano ISKLJUČENO. Prekidač postoji da bi sutrašnji uvoz istorije mogao
 * da se izvrši bez ijedne spoljne posledice: dok je gate isključen, ne postoji
 * ni ekran, ni ručni recompute, ni jedan red koji bi neko mogao da pošalje
 * kupcu.
 *
 * Traži se doslovno `"1"`. `"0"`, `"false"`, prazan string i odsustvo daju isto:
 * isključeno. Da se prihvatalo `Boolean(value)`, string `"0"` bi uključio
 * funkciju.
 *
 * Čita se PO ZAHTEVU, ne pri učitavanju modula: gašenje mora da važi odmah, bez
 * ponovnog pokretanja procesa. Isti obrazac kao `lib/sync/http/gate.ts`.
 */
export const FEATURE_FLAG = "FEATURE_RECOMMENDATIONS";

export function isRecommendationsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[FEATURE_FLAG] === "1";
}

/**
 * Šta gate NE kontroliše, jer to ne postoji ni kada je uključen:
 *
 *  - kupčev pogled na preporuke (ruta ne postoji u kupčevom portalu),
 *  - automatsko slanje poruke kupcu,
 *  - automatsku porudžbinu,
 *  - automatski recompute posle svakog dokumenta.
 *
 * Ovo je spisak funkcija koje V1 NEMA — ne funkcija koje su isključene. Razlika
 * je važna: isključena funkcija se uključuje prekidačem, a nepostojeća traži
 * izmenu koda i novu odluku.
 */
export const V1_NE_POSTOJI = Object.freeze([
  "customer_facing_recommendations",
  "automatic_order_creation",
  "automatic_customer_messaging",
  "automatic_recompute_on_ingest",
  "quantity_forecast",
  "price_or_margin_claim",
  "cross_sell",
]);
