"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  AssignmentError,
  assignCustomer,
  customerExists,
  removeAssignment,
} from "@/lib/partners/assignment-service";
import { CustomerStatusError, setCustomerActive } from "@/lib/customers/customer-status-service";

export type AssignmentActionState = { error: string | null; ok: string | null };

const schema = z.object({
  customerId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

function parse(formData: FormData) {
  return schema.safeParse({
    customerId: formData.get("customerId"),
    userId: formData.get("userId"),
    reason: formData.get("reason") ?? "",
  });
}

/**
 * Dodela menja OPSEG drugog čoveka — ko čije kupce vidi. Zato
 * `assignments:manage` (samo gazda), a ne `view:kupci`.
 */
export async function assignCustomerAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const actor = await requireCapability("assignments:manage", "/portal/kupci");
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Izaberite komercijalistu i unesite razlog.", ok: null };
  if (!(await customerExists(parsed.data.customerId))) return { error: "Kupac ne postoji.", ok: null };
  try {
    const r = await assignCustomer(parsed.data, { id: actor.id, name: actor.name, role: actor.role });
    revalidatePath(`/portal/kupci/${parsed.data.customerId}`);
    return { error: null, ok: r.created ? "Kupac je dodeljen." : "Dodela već postoji." };
  } catch (error) {
    if (error instanceof AssignmentError) return { error: error.message, ok: null };
    throw error;
  }
}

export async function removeAssignmentAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const actor = await requireCapability("assignments:manage", "/portal/kupci");
  const parsed = parse(formData);
  if (!parsed.success) return { error: "Unesite razlog oduzimanja.", ok: null };
  try {
    const r = await removeAssignment(parsed.data, { id: actor.id, name: actor.name, role: actor.role });
    revalidatePath(`/portal/kupci/${parsed.data.customerId}`);
    return { error: null, ok: r.removed ? "Dodela je uklonjena; važi odmah." : "Dodela nije postojala." };
  } catch (error) {
    if (error instanceof AssignmentError) return { error: error.message, ok: null };
    throw error;
  }
}

const statusSchema = z.object({
  customerId: z.string().uuid(),
  active: z.enum(["0", "1"]),
  reason: z.string().max(500),
});

/**
 * Kupac neaktivan / ponovo aktivan — poslovna odluka. Ista sposobnost kao
 * odluke o identitetu i vezama kupca (`mappings:manage`: Vlasnik, ili
 * kancelarija sa paketom „mapiranja"). Ne briše ništa.
 */
export async function setCustomerStatusAction(
  _previous: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const actor = await requireCapability("mappings:manage", "/portal/kupci");
  const parsed = statusSchema.safeParse({
    customerId: formData.get("customerId"),
    active: formData.get("active"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "Neispravan zahtev.", ok: null };
  try {
    const r = await setCustomerActive(
      { customerId: parsed.data.customerId, active: parsed.data.active === "1", reason: parsed.data.reason },
      { id: actor.id, name: actor.name, role: actor.role },
    );
    revalidatePath(`/portal/kupci/${parsed.data.customerId}`);
    revalidatePath("/portal/kupci");
    revalidatePath("/portal/za-razgovor");
    revalidatePath("/portal/preporuke");
    return {
      error: null,
      ok: r.active
        ? "Kupac je vraćen u aktivne."
        : "Kupac je označen kao neaktivan. Istorija ostaje; izostavlja se sa „Za razgovor“, iz predloga i poziva.",
    };
  } catch (error) {
    if (error instanceof CustomerStatusError) return { error: error.message, ok: null };
    throw error;
  }
}
