/**
 * Oblik odgovora obrasca za promenu lozinke kodom.
 *
 * Odvojeno od `actions.ts` jer fajl sa `"use server"` sme da izvozi isključivo
 * asinhrone funkcije.
 */
export type ResetFormState = { error: string | null; done: boolean };

export const EMPTY_RESET: ResetFormState = { error: null, done: false };
