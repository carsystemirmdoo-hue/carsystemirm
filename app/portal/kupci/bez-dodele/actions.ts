"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { AssignmentError, assignCustomer, customerExists, transferCustomers } from "@/lib/partners/assignment-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Brza dodela sa spiska „Bez komercijaliste“ (2026-11-24): izbor u padajućem meniju = dodela. */
export async function quickAssignAction(customerId: string, userId: string): Promise<{ ok: boolean; message: string }> {
  const actor = await requireCapability("assignments:manage", "/portal/kupci/bez-dodele");
  if (!UUID.test(customerId) || !UUID.test(userId)) return { ok: false, message: "Neispravan izbor." };
  if (!(await customerExists(customerId))) return { ok: false, message: "Kupac ne postoji." };
  try {
    await assignCustomer({ customerId, userId, reason: "Brza dodela sa spiska „Bez komercijaliste“." }, { id: actor.id, name: actor.name, role: actor.role });
    revalidatePath(`/portal/kupci/${customerId}`);
    return { ok: true, message: "Dodeljeno" };
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, message: error.message };
    throw error;
  }
}

/** Predaja svih kupaca jednog komercijaliste drugom (npr. kada neko ode iz firme). */
export async function transferCustomersAction(fromUserId: string, toUserId: string, reason: string): Promise<{ ok: boolean; message: string }> {
  const actor = await requireCapability("assignments:manage", "/portal/admin");
  if (!UUID.test(fromUserId) || !UUID.test(toUserId)) return { ok: false, message: "Izaberite oba komercijaliste." };
  try {
    const r = await transferCustomers({ fromUserId, toUserId, reason }, { id: actor.id, name: actor.name, role: actor.role });
    revalidatePath("/portal/admin");
    revalidatePath("/portal/kupci");
    return { ok: true, message: r.moved ? `Predato kupaca: ${r.moved}. Važi odmah.` : "Komercijalista nema dodeljenih kupaca." };
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, message: error.message };
    throw error;
  }
}
