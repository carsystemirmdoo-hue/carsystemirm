/**
 * Ugovor kolačića sesije — eksplicitno, umesto oslanjanja na podrazumevano.
 *
 * Auth.js v5 (`@auth/core` 0.41) već postavlja `httpOnly`, `sameSite: "lax"`,
 * `path: "/"`, `secure` i — što je najvažnije — **ne postavlja `domain`**, pa je
 * kolačić host-only. To je provereno u
 * `node_modules/@auth/core/lib/utils/cookie.js:defaultCookies`.
 *
 * Zašto onda ovo postoji
 * ----------------------
 * Podrazumevano ponašanje je dobro, ali je i nevidljivo: menja se sa verzijom
 * biblioteke i niko to ne bi primetio. Ovde se isti ugovor izgovara naglas i
 * pokriva testom, pa nadogradnja koja ga promeni pada na proveri umesto u
 * produkciji.
 *
 * Jedina stvarna izmena u odnosu na podrazumevano je prefiks imena: `__Host-`
 * umesto `__Secure-` za kolačić sesije. Vidi `sessionCookieName`.
 */

/** Ime kolačića sesije bez prefiksa; isto kao u Auth.js-u. */
const SESSION_COOKIE_BASE = "authjs.session-token";

/**
 * Da li se koriste zaštićeni kolačići.
 *
 * Ime namerno počinje sa `should`, ne sa `use`: ESLint pravilo
 * `react-hooks/rules-of-hooks` svaku funkciju sa `use` prefiksom tretira kao
 * React hook i odbija njen poziv van komponente.
 *
 * Ponavlja izvod iz `@auth/core/lib/init.js`:
 * `config.useSecureCookies ?? url.protocol === "https:"`.
 *
 * Mora ostati veran tom izvodu. Hardkodovan `true` bi pokvario lokalni razvoj
 * na `http://localhost` — pretraživač odbacuje `Secure` kolačić bez HTTPS-a, pa
 * prijava tiho prestaje da radi. Hardkodovan `false` bi u produkciji poslao
 * sesiju preko čistog HTTP-a.
 *
 * @param {{ AUTH_URL?: string, NEXTAUTH_URL?: string, VERCEL_ENV?: string }} env
 * @returns {boolean}
 */
export function shouldUseSecureCookies(env = {}) {
  const url = env.AUTH_URL ?? env.NEXTAUTH_URL;
  if (typeof url === "string" && url !== "") {
    return url.startsWith("https://");
  }
  // Bez podešene adrese: Vercel produkcija je uvek HTTPS. Sve ostalo se tretira
  // kao lokalni razvoj, jer je pogrešno uključivanje skuplje od isključivanja —
  // u produkciji `AUTH_URL` ionako postoji.
  return env.VERCEL_ENV === "production";
}

/**
 * Ime kolačića sesije.
 *
 * Auth.js podrazumevano koristi `__Secure-` za sesiju, a `__Host-` samo za CSRF.
 * Ovde se i sesija diže na `__Host-`, jer ispunjava sva tri uslova tog prefiksa:
 *
 *   - `Secure` je uključen,
 *   - `Path=/`,
 *   - `Domain` se ne postavlja.
 *
 * Razlika je stvarna: `__Secure-` dozvoljava da kolačić postavi bilo koji
 * poddomen sa HTTPS-om, dok `__Host-` to zabranjuje. Kada portal dobije svoj
 * poddomen, ta razlika je granica između host-only sesije i sesije koju drugi
 * poddomen može podmetnuti.
 *
 * Bez zaštićenih kolačića (lokalni HTTP) prefiks se izostavlja — pretraživač bi
 * inače odbio kolačić i prijava ne bi radila.
 *
 * @param {boolean} secure
 * @returns {string}
 */
export function sessionCookieName(secure) {
  return secure ? `__Host-${SESSION_COOKIE_BASE}` : SESSION_COOKIE_BASE;
}

/**
 * Opcije kolačića sesije.
 *
 * `domain` se NAMERNO ne navodi. Izostavljen atribut znači host-only kolačić:
 * važi tačno za host koji ga je postavio i ne curi na druge poddomene. Postaviti
 * `domain` ovde značilo bi da bi sesija portala bila vidljiva javnom sajtu.
 *
 * @param {boolean} secure
 * @returns {{ httpOnly: true, sameSite: "lax", path: "/", secure: boolean }}
 */
export function sessionCookieOptions(secure) {
  return {
    // JavaScript u strani ne sme pročitati sesiju.
    httpOnly: true,
    /*
     * `lax`, ne `strict`.
     *
     * Prijava je POST obrazac koji se vraća na portal; `strict` bi odbacio
     * kolačić pri povratku sa spoljne adrese i korisnik bi ostao odjavljen bez
     * poruke. `lax` i dalje ne šalje kolačić uz unakrsne POST zahteve, što je
     * zaštita koja ovde zaista treba.
     */
    sameSite: "lax",
    path: "/",
    secure,
  };
}

/**
 * Ceo ugovor na jednom mestu, spreman za `NextAuthConfig.cookies`.
 *
 * @param {{ AUTH_URL?: string, NEXTAUTH_URL?: string, VERCEL_ENV?: string }} env
 */
export function sessionCookieContract(env = {}) {
  const secure = shouldUseSecureCookies(env);
  return {
    secure,
    name: sessionCookieName(secure),
    options: sessionCookieOptions(secure),
  };
}
