/**
 * Oblik odgovora administratorskih bezbednosnih akcija.
 *
 * Odvojeno od `actions.ts` jer fajl sa `"use server"` sme da izvozi isključivo
 * asinhrone funkcije.
 */

/** Jednokratna tajna koja se prikazuje tačno jednom, odmah po izdavanju. */
export type IssuedSecret = {
  kind: "reset" | "grant";
  code: string;
  expiresAt: string;
  /** Kome je izdata — da administrator ne preda kod pogrešnoj osobi. */
  targetEmail: string;
};

export type SecurityAdminState = {
  error: string | null;
  ok: string | null;
  /** Postoji samo u odgovoru koji ju je napravio; nikad se ne čita iz baze. */
  issued: IssuedSecret | null;
};

export const EMPTY_SECURITY_ADMIN: SecurityAdminState = {
  error: null,
  ok: null,
  issued: null,
};
