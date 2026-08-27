import type { DefaultSession } from "next-auth";
// Uvoz je nužan da bi TypeScript uopšte primenio augmentaciju `next-auth/jwt`;
// bez njega se blok ispod tiho ignoriše i `token.sessionVersion` ostane `{}`.
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * Verzija sesije iz trenutka prijave.
       *
       * Poredi se sa vrednošću u bazi pri svakom zahtevu; neslaganje znači da
       * je sesija opozvana. Nije tajna i ne nosi nikakvo ovlašćenje — dozvole
       * se i dalje čitaju iz baze.
       */
      sessionVersion?: number;
      /** `password` | `mfa` | `recovery` — čime je sesija potvrđena. */
      assurance?: string;
      /** Kada je drugi faktor potvrđen; osnova za „sudo" prozor. */
      mfaVerifiedAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    assurance?: string;
    mfaVerifiedAt?: number;
  }
}

// Zadržava `JWT` kao korišćen uvoz; bez ovoga ga linter uklanja i augmentacija
// ponovo prestaje da važi.
export type PortalJwt = JWT;

export {};
