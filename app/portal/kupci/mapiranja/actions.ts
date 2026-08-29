"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ExternalIdentityError,
  resolveExternalIdentifier,
} from "@/lib/commercial/identity-service";
import { requireCapability } from "@/lib/authz/session";

export type IdentityActionState = { error: string | null; ok: string | null };

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["mapped", "unmapped", "disabled"]),
  // Prazan string se ne sme pretvoriti u „nema kupca" tiho — vidi ispod.
  customerId: z.string().uuid().nullable(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Ručno razrešenje šifre partnera.
 *
 * Jedini put kojim `conflict` izlazi iz konflikta. Sistem ovde ne predlaže i ne
 * bira — samo zapisuje odluku čoveka, uz obavezan razlog.
 */
export async function resolveIdentityAction(
  _previous: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const actor = await requireCapability("mappings:manage", "/portal/kupci/mapiranja");

  const rawCustomer = formData.get("customerId");
  const parsed = schema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    customerId:
      typeof rawCustomer === "string" && rawCustomer.length > 0 ? rawCustomer : null,
    reason: formData.get("reason") ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Izaberite stanje i unesite razlog (najmanje 3 znaka).",
      ok: null,
    };
  }

  try {
    await resolveExternalIdentifier(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
  } catch (error) {
    if (error instanceof ExternalIdentityError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }

  revalidatePath("/portal/kupci/mapiranja");
  return { error: null, ok: "Šifra partnera je razrešena." };
}
