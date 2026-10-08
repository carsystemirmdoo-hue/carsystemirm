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
 *  - automatsku porudžbinu.
 *
 * Automatski obračun posle uvoza POSTOJI od 0032, ali iza sopstvenog
 * prekidača (`RECOMMENDATIONS_AUTO_RECOMPUTE`) i spojen po skeniranju — ne
 * posle svakog dokumenta. Predlozi dodatnih proizvoda (F9) su zaseban,
 * interni modul (`crossSell.mjs`), nisu deo `cadence_v1`.
 *
 * Ovo je spisak funkcija koje V1 NEMA — ne funkcija koje su isključene. Razlika
 * je važna: isključena funkcija se uključuje prekidačem, a nepostojeća traži
 * izmenu koda i novu odluku.
 */
export const V1_NE_POSTOJI = Object.freeze([
  "customer_facing_recommendations",
  "automatic_order_creation",
  "automatic_customer_messaging",
  "quantity_forecast",
  "price_or_margin_claim",
]);

/**
 * Automatski obračun posle uspešnog uvoza — samo uz uključene preporuke I
 * izričito uključen ovaj prekidač (samo tačno „1"). Podrazumevano isključeno.
 */
export const AUTO_RECOMPUTE_FLAG = "RECOMMENDATIONS_AUTO_RECOMPUTE";

export function isAutoRecomputeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isRecommendationsEnabled(env) && env[AUTO_RECOMPUTE_FLAG] === "1";
}
