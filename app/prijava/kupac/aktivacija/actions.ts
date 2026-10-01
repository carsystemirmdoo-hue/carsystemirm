"use server";

import { z } from "zod";
import { CustomerAccountError } from "@/lib/customers/account-service";
import {
  activateWithInvitation,
  completePasswordReset,
  CUSTOMER_PASSWORD_MIN,
  requestPasswordReset,
} from "@/lib/customers/invitation-service";

export type ActivationState = { error: string | null; ok: string | null };

/**
 * Ista poruka za svaki neuspeh tokena.
 *
 * Istekao, već iskorišćen i nepostojeći token spolja izgledaju identično.
 * Razlika bi rekla napadaču da je pogodio oblik tokena ili da je nalog
 * postojao.
 */
const GENERIC_TOKEN_ERROR =
  "Link nije važeći ili je istekao. Zatražite nov od kancelarije.";

const schema = z.object({
  token: z.string().trim().min(8).max(200),
  password: z.string().min(CUSTOMER_PASSWORD_MIN).max(200),
  confirm: z.string().min(1).max(200),
});

function parse(formData: FormData) {
  return schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
}

export async function activateAccountAction(
  _previous: ActivationState,
  formData: FormData,
): Promise<ActivationState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      error: `Lozinka mora imati najmanje ${CUSTOMER_PASSWORD_MIN} znakova.`,
      ok: null,
    };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Lozinke se ne poklapaju.", ok: null };
  }

  try {
    const { ok } = await activateWithInvitation(parsed.data);
    return ok
      ? { error: null, ok: "Nalog je aktiviran. Možete se prijaviti." }
      : { error: GENERIC_TOKEN_ERROR, ok: null };
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }
}

export async function completeResetAction(
  _previous: ActivationState,
  formData: FormData,
): Promise<ActivationState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return {
      error: `Lozinka mora imati najmanje ${CUSTOMER_PASSWORD_MIN} znakova.`,
      ok: null,
    };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Lozinke se ne poklapaju.", ok: null };
  }

  try {
    const { ok } = await completePasswordReset(parsed.data);
    return ok
      ? { error: null, ok: "Lozinka je promenjena. Možete se prijaviti." }
      : { error: GENERIC_TOKEN_ERROR, ok: null };
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

/**
 * „Zaboravljena lozinka".
 *
 * Odgovor je UVEK isti, bez obzira na to da li nalog postoji. Razlika bi bila
 * enumeracija naloga — spisak kupaca jedne firme je poslovno osetljiv podatak.
 *
 * Token se NE vraća korisniku: upisuje se outbox red koji kancelarija vidi i
 * dalje isporučuje. Provajder e-pošte ne postoji i ne dodaje se.
 */
export async function requestResetAction(
  _previous: ActivationState,
  formData: FormData,
): Promise<ActivationState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  const generic = {
    error: null,
    ok: "Ako nalog postoji, kancelarija će Vam dostaviti link za promenu lozinke.",
  };
  if (!parsed.success) return generic;

  await requestPasswordReset(parsed.data);
  return generic;
}
