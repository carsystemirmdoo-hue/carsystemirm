"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  createCustomerAccount,
  CustomerAccountError,
  setCustomerAccountStatus,
} from "@/lib/customers/account-service";

export type AccountActionState = { error: string | null; ok: string | null };

const createSchema = z.object({
  customerId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(200),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Otvaranje kupčevog naloga.
 *
 * Lozinka se prosleđuje serveru i odmah hešira; nigde se ne vraća u odgovor i
 * ne ulazi u trag revizije. Predaja lozinke kupcu je van sistema — isti obrazac
 * kao kod internog reseta (`docs/b2b/11-account-recovery-runbook.md`).
 */
export async function createAccountAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability(
    "customer_accounts:manage",
    "/portal/kupci/nalozi",
  );

  const parsed = createSchema.safeParse({
    customerId: formData.get("customerId"),
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return {
      error:
        "Proverite unos: kupac, ispravna e-pošta, ime, lozinka od najmanje 12 znakova i razlog.",
      ok: null,
    };
  }

  try {
    await createCustomerAccount(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }

  revalidatePath("/portal/kupci/nalozi");
  return {
    error: null,
    ok: "Nalog je otvoren. Lozinku predajte kupcu van sistema — nigde se ne prikazuje ponovo.",
  };
}

const statusSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(["approved", "suspended", "rejected"]),
  reason: z.string().trim().min(3).max(500),
});

export async function setAccountStatusAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability(
    "customer_accounts:manage",
    "/portal/kupci/nalozi",
  );

  const parsed = statusSchema.safeParse({
    accountId: formData.get("accountId"),
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: "Izaberite stanje i unesite razlog (najmanje 3 znaka).", ok: null };
  }

  try {
    await setCustomerAccountStatus(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }

  revalidatePath("/portal/kupci/nalozi");
  return {
    error: null,
    ok: "Stanje naloga je promenjeno; sve postojeće sesije tog naloga su opozvane.",
  };
}
