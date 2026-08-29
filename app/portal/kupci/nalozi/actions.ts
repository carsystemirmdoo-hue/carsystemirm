"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  CustomerAccountError,
  proposeCustomerContact,
  setCustomerAccountStatus,
} from "@/lib/customers/account-service";
import {
  issueInvitation,
  markOutboxHandedOver,
} from "@/lib/customers/invitation-service";
import { requireCustomerAccess } from "@/lib/authz/session";

export type AccountActionState = { error: string | null; ok: string | null };

const proposeSchema = z.object({
  customerId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Predlog kontakt-osobe kupca.
 *
 * NE prima lozinku — polje za nju ne postoji. Nalog nastaje u stanju
 * `requested`, bez prava prijave. Komercijalista sme ovo samo za dodeljenog
 * kupca; kapija je `requireCustomerAccess`, isti put kojim je već zaštićen
 * ekran kupca.
 */
export async function proposeContactAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability(
    "customer_accounts:propose",
    "/portal/kupci/nalozi",
  );

  const parsed = proposeSchema.safeParse({
    customerId: formData.get("customerId"),
    email: formData.get("email"),
    name: formData.get("name"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "Proverite unos: kupac, ispravna e-pošta, ime i razlog.",
      ok: null,
    };
  }

  // `customerId` stiže iz forme — mora proći kapiju opsega.
  await requireCustomerAccess(actor, parsed.data.customerId);

  try {
    await proposeCustomerContact(parsed.data, {
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
    ok: "Kontakt je predložen. Nalog još nema pristup — poziv izdaje kancelarija.",
  };
}

const inviteSchema = z.object({
  accountId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Izdaje poziv i vraća link TAČNO JEDNOM.
 *
 * Link se posle ovog odgovora više ne može prikazati: u bazi stoji samo HMAC
 * otisak tokena. Kancelarija ga predaje kupcu van sistema (provajder e-pošte
 * ne postoji i ne dodaje se — COST_CONTROL).
 */
export async function issueInvitationAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState & { link: string | null }> {
  const actor = await requireCapability(
    "customer_accounts:manage",
    "/portal/kupci/nalozi",
  );

  const parsed = inviteSchema.safeParse({
    accountId: formData.get("accountId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: "Unesite razlog (najmanje 3 znaka).", ok: null, link: null };
  }

  try {
    const { token, expiresAt } = await issueInvitation(parsed.data, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
    });
    revalidatePath("/portal/kupci/nalozi");
    return {
      error: null,
      ok: `Poziv važi do ${expiresAt.toLocaleString("sr-Latn-RS")}. Link se prikazuje samo sada.`,
      link: `/prijava/kupac/aktivacija?token=${encodeURIComponent(token)}`,
    };
  } catch (error) {
    if (error instanceof CustomerAccountError) {
      return { error: error.message, ok: null, link: null };
    }
    throw error;
  }
}

const outboxSchema = z.coerce.number().int().positive();

export async function markHandedOverAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability(
    "customer_accounts:manage",
    "/portal/kupci/nalozi",
  );
  const parsed = outboxSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { error: "Stavka nije prepoznata.", ok: null };

  const done = await markOutboxHandedOver(parsed.data, {
    id: actor.id,
    name: actor.name,
    role: actor.role,
  });
  revalidatePath("/portal/kupci/nalozi");
  return done
    ? { error: null, ok: "Označeno kao predato." }
    : { error: "Stavka nije dostupna.", ok: null };
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
