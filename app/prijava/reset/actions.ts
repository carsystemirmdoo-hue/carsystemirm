"use server";

import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { clientIpFromRequest } from "@/lib/auth/client-ip";
import { completePasswordReset } from "@/lib/auth/password-reset";
import { registerAttempt } from "@/lib/auth/rate-limit-service";
import { EMPTY_RESET, type ResetFormState } from "./types";

/**
 * Promena lozinke kodom koji je izdao vlasnik.
 *
 * Ovo je jedina akcija koju poziva neprijavljen korisnik, pa je i jedina koja
 * mora sama da nosi celu zaštitu: ograničenje pokušaja, jednaku poruku za svaki
 * neuspeh i atomsko trošenje koda.
 */

/**
 * Ista poruka za sve neuspehe.
 *
 * Razlikovanje „nalog ne postoji" od „kod je pogrešan" pretvorilo bi ovaj
 * obrazac u sredstvo za proveru koje adrese postoje u sistemu.
 */
const GENERIC =
  "Kod nije prihvaćen. Proverite e-poštu i kod, ili zatražite nov od vlasnika.";

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    code: z.string().trim().min(8).max(64),
    password: z.string().min(12).max(200),
    confirm: z.string().min(1).max(200),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Potvrda se ne poklapa sa novom lozinkom.",
  });

export async function completeResetAction(
  _previous: ResetFormState,
  formData: FormData,
): Promise<ResetFormState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      ...EMPTY_RESET,
      error:
        parsed.error.issues[0]?.message ??
        "Proverite unos: ispravna e-pošta i lozinka od najmanje 12 znakova.",
    };
  }

  const { email, code, password } = parsed.data;
  const clientIp = await clientIpFromRequest();

  /*
   * Brojač se povećava PRE provere koda.
   *
   * Da se povećava tek posle neuspeha, uspešan pogodak ne bi ostavio trag u
   * brojaču — a napad se i sastoji od mnogo pokušaja do jednog pogotka.
   */
  const decision = await registerAttempt({
    scope: "reset",
    accountIdentifier: email,
    clientIp,
  });
  if (!decision.allowed) {
    await recordAudit({
      actor: { id: null, name: "Neprijavljen", role: "anon" },
      action: AUDIT_ACTIONS.rateLimitBlocked,
      entityType: "Promena lozinke",
      entityLabel: email,
      // Ni kod ni sirova adresa ne ulaze u trag.
      reason: "Previše pokušaja promene lozinke kodom",
    });
    return {
      ...EMPTY_RESET,
      error: "Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo.",
    };
  }

  const outcome = await completePasswordReset({
    email,
    code,
    newPassword: password,
  });
  if (!outcome.ok) return { ...EMPTY_RESET, error: GENERIC };

  await recordAudit({
    actor: { id: outcome.userId, name: outcome.name, role: outcome.role },
    action: AUDIT_ACTIONS.passwordResetCompleted,
    entityType: "Korisnik",
    entityId: outcome.userId,
    entityLabel: outcome.email,
    reason: "Lozinka promenjena kodom koji je izdao vlasnik",
  });
  await recordAudit({
    actor: { id: outcome.userId, name: outcome.name, role: outcome.role },
    action: AUDIT_ACTIONS.sessionsRevoked,
    entityType: "Korisnik",
    entityId: outcome.userId,
    entityLabel: outcome.email,
    reason: "Sve sesije opozvane posle promene lozinke kodom",
  });

  return { error: null, done: true };
}
