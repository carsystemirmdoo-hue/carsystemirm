/**
 * Oblik odgovora akcije za promenu lozinke.
 *
 * Odvojeno od `actions.ts` jer fajl sa `"use server"` sme da izvozi isključivo
 * asinhrone funkcije.
 */
export type PasswordChangeState = {
  error: string | null;
  /** Postavljeno tek kada je lozinka stvarno promenjena. */
  done: boolean;
};

export const EMPTY_PASSWORD_CHANGE: PasswordChangeState = {
  error: null,
  done: false,
};
