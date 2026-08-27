/**
 * Oblik odgovora enrollment akcija.
 *
 * Odvojeno od `actions.ts` jer fajl sa `"use server"` sme da izvozi isključivo
 * asinhrone funkcije — konstanta i tip bi oborili build.
 */
export type EnrollmentState = {
  error: string | null;
  /** Postoji samo u odgovoru koji ga je napravio; nikad se ne čita iz baze. */
  setup: { base32: string; uri: string; expiresAt: string } | null;
  /** Prikazuju se tačno jednom, odmah po aktivaciji ili ponovnom izdavanju. */
  recoveryCodes: string[] | null;
  done: boolean;
};

export const EMPTY_ENROLLMENT: EnrollmentState = {
  error: null,
  setup: null,
  recoveryCodes: null,
  done: false,
};
