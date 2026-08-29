"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  ConsentError,
  recordConsentEvent,
} from "@/lib/customers/consent-service";
import {
  CONSENT_PURPOSES,
  CURRENT_CONSENT_TEXT_VERSION,
} from "@/lib/customers/consent.mjs";

export type ConsentActionState = { error: string | null; ok: string | null };

const schema = z.object({
  purpose: z.enum(CONSENT_PURPOSES as [string, ...string[]]),
  action: z.enum(["granted", "withdrawn"]),
});

/**
 * Kupac menja sopstvenu saglasnost.
 *
 * `customerUserId` dolazi ISKLJUČIVO iz sesije. Obrazac ne šalje nijedan
 * identifikator naloga — ne zato što bi bio odbijen, nego zato što takvo polje
 * ne postoji, pa nema šta da se promeni u devtools-u.
 */
export async function setConsentAction(
  _previous: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  const session = await requireCustomerSession();

  const parsed = schema.safeParse({
    purpose: formData.get("purpose"),
    action: formData.get("action"),
  });
  if (!parsed.success) {
    return { error: "Radnja nije prepoznata.", ok: null };
  }

  try {
    await recordConsentEvent(
      {
        customerUserId: session.accountId,
        purpose: parsed.data.purpose as "email_marketing" | "ad_personalization",
        action: parsed.data.action,
        source: "customer_self_service",
        consentTextVersion: CURRENT_CONSENT_TEXT_VERSION,
      },
      {
        kind: "customer",
        accountId: session.accountId,
        email: session.email,
        customerName: session.customerName,
      },
    );
  } catch (error) {
    if (error instanceof ConsentError) return { error: error.message, ok: null };
    throw error;
  }

  revalidatePath("/kupac/saglasnosti");
  return {
    error: null,
    ok:
      parsed.data.action === "granted"
        ? "Saglasnost je zabeležena."
        : "Saglasnost je povučena. Raniji zapis ostaje u istoriji.",
  };
}
