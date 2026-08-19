import type { NextAuthConfig } from "next-auth";
import { normalizeCallback } from "./lib/authz/redirects.mjs";

/**
 * Deo konfiguracije koji sme da se izvršava na edge runtime-u (middleware).
 *
 * Ovde namerno nema ni baze ni provajdera: middleware samo dekodira token da bi
 * znao da li da preusmeri na prijavu. Stvarno ovlašćivanje se radi na serveru,
 * u `lib/authz/session.ts`, gde se dozvole čitaju iz baze.
 */
export const authConfig = {
  trustHost: true,
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
      return token;
    },
    session({ session, token }) {
      // U tokenu stoji isključivo identitet. Uloga i dozvole se namerno ne
      // prenose ovuda — čitaju se iz baze pri svakom zahtevu, pa oduzimanje
      // dozvole deluje odmah umesto da čeka istek tokena.
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
