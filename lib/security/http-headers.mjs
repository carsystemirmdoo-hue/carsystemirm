/**
 * Bezbednosna HTTP zaglavlja.
 *
 * Politika je izvedena iz STVARNOG inventara izvora, ne iz uobičajenog uzorka.
 * Inventar (avgust 2026):
 *
 *   - fontovi     — `next/font/google` ih preuzima pri buildu i servira sa
 *                   `/_next/static/media/`; nema zahteva ka Google-u u radu;
 *   - mape        — MapLibre povlači stil i pločice sa `tiles.openfreemap.org`
 *                   i koristi Web Worker preko `blob:`;
 *   - analitika   — ne postoji;
 *   - Turnstile / captcha — ne postoji;
 *   - iframe      — nijedan; ni sopstveni ni tuđi;
 *   - forme       — sve idu na sopstveni host (server actions i `onSubmit`).
 *
 * Zašto se politika deli na dva zaglavlja
 * ---------------------------------------
 * Next.js App Router ubacuje inline `<script>` sa RSC podacima u svaku stranu.
 * Bez `nonce` vrednosti to traži `'unsafe-inline'`, a `nonce` bi zahtevao
 * dinamičko renderovanje — čime bi 1.114 statički generisanih strana prestalo
 * to da bude. Zato:
 *
 *   - `Content-Security-Policy` (na snazi) nosi samo direktive koje ništa ne
 *     mogu slomiti, a zatvaraju stvarne napade: klik-otmicu, ubacivanje
 *     `<base>`, slanje obrasca na tuđi host i učitavanje dodataka;
 *   - `Content-Security-Policy-Report-Only` nosi punu politiku, uključujući
 *     `script-src`, pa se prekršaji vide bez rizika da se sajt pokvari.
 *
 * Plan uklanjanja `'unsafe-inline'` je u `docs/b2b/08-phased-implementation-plan.md`.
 */

/** Jedini spoljni host koji aplikacija zaista poziva u radu. */
export const MAP_TILES_ORIGIN = "https://tiles.openfreemap.org";

/**
 * Direktive koje se primenjuju odmah.
 *
 * Nijedna od njih ne dodiruje skripte ni stilove, pa ne može oboriti stranu.
 */
const ENFORCED_DIRECTIVES = [
  // Sajt se ne sme prikazati u tuđem okviru. Nijedna funkcija ne koristi iframe.
  "frame-ancestors 'none'",
  // Nema Flash-a, applet-a ni drugih dodataka.
  "object-src 'none'",
  // Ubačeni `<base href>` bi preusmerio svaku relativnu adresu na tuđi host.
  "base-uri 'self'",
  // Obrazac ne sme poslati podatke van sopstvenog hosta.
  "form-action 'self'",
];

/**
 * Puna politika — za sada samo u režimu prijave prekršaja.
 *
 * @returns {string[]}
 */
const REPORT_ONLY_DIRECTIVES = [
  "default-src 'self'",
  /*
   * `'unsafe-inline'` je ovde PRIVREMENO i namerno vidljivo.
   *
   * Traži ga Next.js App Router za svoj inline RSC payload. Uklanja se tek kada
   * portal bude izdvojen u sopstvenu aplikaciju sa dinamičkim renderovanjem —
   * tada nonce ima smisla, jer portal ionako nije statički. Javni sajt do tada
   * ostaje statički i bez nonce-a.
   */
  "script-src 'self' 'unsafe-inline'",
  // Next ubacuje kritični CSS inline; MapLibre postavlja stilove kroz DOM.
  "style-src 'self' 'unsafe-inline'",
  // `next/font` self-hostuje fontove pri buildu.
  "font-src 'self'",
  // `data:` za ugrađene ikone, `blob:` za MapLibre platno.
  `img-src 'self' data: blob: ${MAP_TILES_ORIGIN}`,
  // Stil i vektorske pločice mape.
  `connect-src 'self' ${MAP_TILES_ORIGIN}`,
  // MapLibre pokreće svoj radnik iz `blob:` URL-a.
  "worker-src 'self' blob:",
  "media-src 'self'",
  "manifest-src 'self'",
  ...ENFORCED_DIRECTIVES,
];

/**
 * HSTS — samo za produkcijski HTTPS.
 *
 * Namerno konzervativno za prvo uključivanje:
 *   - bez `preload`  — upis u listu pretraživača se teško povlači;
 *   - bez `includeSubDomains` — poddomen portala tek dolazi i ne sme biti
 *     zaključan pre nego što dobije ispravan sertifikat;
 *   - kratak `max-age` — jedan dan, dovoljno da zaštiti, dovoljno kratko da se
 *     greška sama poništi.
 *
 * Vrednost se podiže tek kada se potvrdi da svi hostovi rade preko HTTPS-a.
 */
export const HSTS_VALUE = "max-age=86400";

/**
 * Da li se primenjuje HSTS.
 *
 * Nikada u razvoju i nikada na preview hostovima: `Strict-Transport-Security`
 * na `http://localhost` bi pretraživač zapamtio i prisilio HTTPS na loopback
 * adresi, posle čega lokalni razvoj prestaje da radi dok se ne očisti stanje
 * pretraživača.
 *
 * @param {{ VERCEL_ENV?: string, NODE_ENV?: string }} env
 * @returns {boolean}
 */
export function shouldSendHsts(env = {}) {
  return env.VERCEL_ENV === "production";
}

/**
 * Zaglavlja koja važe za svaku rutu.
 *
 * @param {{ VERCEL_ENV?: string, NODE_ENV?: string }} env
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders(env = {}) {
  const headers = [
    { key: "Content-Security-Policy", value: ENFORCED_DIRECTIVES.join("; ") },
    {
      key: "Content-Security-Policy-Report-Only",
      value: REPORT_ONLY_DIRECTIVES.join("; "),
    },
    // Pretraživač ne sme da pogađa tip sadržaja; sprečava da se otpremljeni
    // fajl protumači kao skripta.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Pun URL se šalje samo istom poreklu; spolja odlazi samo domen.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      /*
       * Geolokacija se NE gasi: „Pronađi najbližu prodavnicu" je glavni javni
       * poziv na akciju i traži je (`components/stores/StoreLocator.tsx`,
       * `components/home/CarsystemHomePage.tsx`). Ostalo se gasi jer se ne
       * koristi nigde.
       */
      key: "Permissions-Policy",
      value: [
        "geolocation=(self)",
        "camera=()",
        "microphone=()",
        "payment=()",
        "usb=()",
        "magnetometer=()",
        "gyroscope=()",
        "accelerometer=()",
        "interest-cohort=()",
      ].join(", "),
    },
  ];

  if (shouldSendHsts(env)) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }

  return headers;
}

/**
 * Putanje koje nikada ne smeju u keš.
 *
 * Njihov odgovor u nekom trenutku nosi materijal koji se sme videti tačno
 * jednom: ključ za vezivanje, rezervne kodove, kod za promenu lozinke.
 * Keširana kopija — u pretraživaču, kod posrednika ili u istoriji „Nazad" —
 * značila bi da se to jednom ponovi.
 *
 * `force-dynamic` u samoj strani sprečava prerender, ali NE postavlja zaglavlje.
 * Zato ide i ovde.
 */
export const NO_STORE_PATHS = [
  "/portal/bezbednost/:path*",
  "/prijava/reset",
];

/**
 * Zaglavlja protiv keširanja.
 *
 * `no-store` je jedina direktiva koja stvarno zabranjuje čuvanje; `no-cache`
 * samo traži proveru pre upotrebe, pa bi kopija i dalje ležala na disku.
 * `Pragma` je tu zbog starijih posrednika koji ne razumeju `Cache-Control`.
 */
export function noStoreHeaders() {
  return [
    { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
    { key: "Pragma", value: "no-cache" },
    { key: "Expires", value: "0" },
  ];
}
