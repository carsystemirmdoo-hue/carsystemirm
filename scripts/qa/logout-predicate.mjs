/**
 * Predikat: da li je pretrazivac zaista na strani prijave.
 *
 * Postoji kao zaseban modul da bi mogao da se testira IZVRSNO. Ranija verzija
 * je bila `adresa.includes("/prijava")` nad punim URL-om, sto je meshalo dva
 * pitanja: „koja je putanja" i „ima li igde u adresi taj niz znakova".
 *
 * Ugovor je PUTANJA, ne ceo URL:
 *   - `/prijava`                              → true
 *   - `/prijava?callbackUrl=%2Fportal%2Fkorpa` → true  (query je dozvoljen)
 *   - `/portal`                                → false
 *
 * `callbackUrl` sam po sebi nije pad: posle odjave je normalno da adresa
 * prijave nosi odrediste sa koga je korisnik odbijen.
 */
import { LOGIN_ROUTE } from "../../lib/authz/redirects.mjs";

/**
 * @param {string} url apsolutan URL iz `page.url()` ili sama putanja
 * @returns {boolean}
 */
export function jeLoginPathname(url) {
  if (typeof url !== "string" || url === "") return false;
  try {
    // Baza sluzi samo da relativna putanja moze da se rasclani; host se ne gleda.
    return new URL(url, "http://qa.invalid").pathname === LOGIN_ROUTE;
  } catch {
    return false;
  }
}
