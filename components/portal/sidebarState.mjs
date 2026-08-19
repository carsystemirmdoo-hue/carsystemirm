/**
 * Stanje leve navigacije.
 *
 * Vrednost se čuva u kolačiću da bi je serverski layout pročitao pre prvog
 * iscrtavanja — bez toga bi navigacija na svakom učitavanju bljesnula u punoj
 * širini pa se skupila. Kada je korisnik prijavljen, ista vrednost se upisuje i
 * u `user_preferences`, pa izbor prati nalog kroz različite pregledače.
 */

export const SIDEBAR_COOKIE = "cs_portal_sidebar";
export const SIDEBAR_PREFERENCE_KEY = "sidebar.collapsed";

/** Dizajn traži ~252px prošireno i 56–68px skupljeno. */
export const SIDEBAR_WIDTH_EXPANDED = 252;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

/** Godinu dana — izbor navigacije nije podatak koji treba da ističe. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export function parseSidebarState(value) {
  return value === "collapsed";
}

/**
 * @param {boolean} collapsed
 * @returns {"collapsed" | "expanded"}
 */
export function serializeSidebarState(collapsed) {
  return collapsed ? "collapsed" : "expanded";
}

/**
 * Širina radne površine mora tačno da prati navigaciju — ni preklapanja sadržaja,
 * ni praznog pojasa koji ostaje posle skupljanja.
 *
 * @param {boolean} collapsed
 * @returns {number}
 */
export function sidebarWidth(collapsed) {
  return collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
}

/**
 * Koliko dodatne širine tabele dobiju kada se navigacija skupi.
 * @returns {number}
 */
export function reclaimedWidth() {
  return SIDEBAR_WIDTH_EXPANDED - SIDEBAR_WIDTH_COLLAPSED;
}

/**
 * Prebacivanje menja isključivo stanje navigacije. Ruta, filteri, sortiranje,
 * izbor redova i pozicija skrola ostaju netaknuti — zato ova funkcija vraća novi
 * objekat sa izmenjenim `collapsed`, a sve ostalo prenosi nepromenjeno.
 *
 * @template {{ collapsed: boolean }} T
 * @param {T} state
 * @returns {T}
 */
export function toggleSidebar(state) {
  return { ...state, collapsed: !state.collapsed };
}

/**
 * @param {boolean} collapsed
 * @returns {string}
 */
export function sidebarCookieValue(collapsed) {
  return [
    `${SIDEBAR_COOKIE}=${serializeSidebarState(collapsed)}`,
    "Path=/",
    `Max-Age=${SIDEBAR_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ].join("; ");
}
