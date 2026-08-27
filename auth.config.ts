import type { NextAuthConfig } from "next-auth";
import { normalizeCallback } from "./lib/authz/redirects.mjs";
import { sessionCookieContract } from "./lib/auth/cookie-policy.mjs";

/*
 * Ugovor kolačića se razrešava jednom, pri učitavanju modula.
 *
 * `useSecureCookies` mora biti isti signal koji Auth.js koristi za izvođenje
 * imena i `Secure` zastavice — inače bi ime govorilo `__Host-`, a zastavica
 * nedostajala, i pretraživač bi odbacio kolačić bez ijedne poruke.
 */
const sessionCookie = sessionCookieContract({
  AUTH_URL: process.env.AUTH_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

/**
 * Deo konfiguracije koji sme da se izvršava na edge runtime-u (middleware).
 *
 * Ovde namerno nema ni baze ni provajdera: middleware samo dekodira token da bi
 * znao da li da preusmeri na prijavu. Stvarno ovlašćivanje se radi na serveru,
 * u `lib/authz/session.ts`, gde se dozvole čitaju iz baze.
 */
export const authConfig = {
  trustHost: true,
  /*
   * Eksplicitno, umesto oslanjanja na podrazumevano ponašanje biblioteke.
   *
   * Auth.js v5 i sam postavlja iste atribute (provereno u
   * `@auth/core/lib/utils/cookie.js`), ali podrazumevano se menja sa verzijom i
   * to niko ne bi primetio. Ovde je ugovor izgovoren i pokriven testom.
   *
   * Menja se samo prefiks imena sesije: `__Host-` umesto `__Secure-`. Ostali
   * kolačići (CSRF, callback-url, state) namerno ostaju na podrazumevanim
   * imenima — nemaju isti ugovor i CSRF već koristi `__Host-`.
   */
  useSecureCookies: sessionCookie.secure,
  cookies: {
    sessionToken: {
      name: sessionCookie.name,
      options: sessionCookie.options,
    },
  },
  pages: {
    signIn: "/prijava",
    error: "/prijava",
  },
  session: {
    strategy: "jwt",
    // Osmočasovna smena; posle toga je potrebna ponovna prijava.
    maxAge: 60 * 60 * 8,
  },
  providers: [],
  callbacks: {
    /**
     * Jedina kapija za sva preusmeravanja posle prijave i odjave.
     *
     * Obrazac prijave već proverava `callbackUrl`, ali direktan POST na
     * `/api/auth/callback/credentials` zaobilazi obrazac. Bez ove provere
     * `//zlonamerno.rs` prolazi kao protokol-relativna adresa i odvodi
     * korisnika van sistema.
     */
    redirect({ url, baseUrl }) {
      const candidate = url.startsWith(baseUrl)
        ? url.slice(baseUrl.length) || "/"
        : url;
      const safe = normalizeCallback(candidate);
      // Bez ispravnog odredišta ide se na `/portal`, koji dalje šalje korisnika
      // na početni ekran njegove uloge.
      return `${baseUrl}${safe ?? "/portal"}`;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      /*
       * Uz identitet se nosi i verzija sesije iz trenutka prijave.
       *
       * To NIJE ovlašćenje i ne daje nikakav pristup — služi samo da se token
       * može opozvati. Bez nje ukraden JWT važi punih osam sati i odjava ga ne
       * poništava, jer Auth.js ne vodi evidenciju izdatih tokena.
       */
      if (user && "sessionVersion" in user) {
        token.sessionVersion = Number(user.sessionVersion) || 0;
      }
      /*
       * Nivo pouzdanosti sesije: da li je drugi faktor stvarno dat.
       *
       * Bez ovoga bi „lozinka je tačna" i „lozinka i drugi faktor su tačni"
       * izgledali isto, pa bi korisnik bez vezanog faktora u režimu `enforced`
       * dobio pun portal. Sam nivo NE daje nikakvo pravo — samo kaže čime je
       * sesija potvrđena; dozvole se i dalje čitaju iz baze.
       */
      if (user && "assurance" in user) {
        token.assurance = String(user.assurance);
        const verifiedAt = (user as { mfaVerifiedAt?: number | null }).mfaVerifiedAt;
        token.mfaVerifiedAt =
          typeof verifiedAt === "number" ? verifiedAt : undefined;
      }
      return token;
    },
    session({ session, token }) {
      // U tokenu stoji isključivo identitet. Uloga i dozvole se namerno ne
      // prenose ovuda — čitaju se iz baze pri svakom zahtevu, pa oduzimanje
      // dozvole deluje odmah umesto da čeka istek tokena.
      if (session.user && token.sub) session.user.id = token.sub;
      // Poređenje sa bazom radi `lib/authz/session.ts`; ovde se vrednost samo
      // prenosi dalje, jer edge runtime nema pristup bazi.
      if (session.user) {
        session.user.sessionVersion = token.sessionVersion ?? 0;
        session.user.assurance = token.assurance;
        session.user.mfaVerifiedAt = token.mfaVerifiedAt;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
