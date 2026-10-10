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
  ConsentError,
  recordOfflineConsentDecision,
} from "@/lib/customers/consent-service";
import {
  issueInvitation,
  markOutboxHandedOver,
} from "@/lib/customers/invitation-service";
import { requireCustomerAccess } from "@/lib/authz/session";
import {
  revokeCustomerAccess,
  verifyCustomerContact,
} from "@/lib/customers/verification-service";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";

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
      ok: `Poziv važi do ${dmyTime(expiresAt)}. Link se prikazuje samo sada.`,
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

const consentSchema = z.object({
  accountId: z.string().uuid(),
  purpose: z.enum(["email_marketing", "ad_personalization"]),
  action: z.enum(["granted", "withdrawn"]),
  requestReference: z.string().trim().min(3).max(300),
});

/**
 * Kancelarija evidentira saglasnost koju je kupac doneo VAN sistema.
 *
 * Kupac sme da opozove saglasnost telefonom, e-poštom, pisanim zahtevom ili
 * lično. Dok to nije moglo da se evidentira, u sistemu je stajao kao saglasan —
 * teže pravilo je proizvodilo netačan zapis.
 *
 * Kapija je `customer_accounts:manage`: komercijalista bez tog paketa ne može
 * dirati tuđu saglasnost.
 */
export async function recordOfflineConsentAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability(
    "customer_accounts:manage",
    "/portal/kupci/nalozi",
  );

  const parsed = consentSchema.safeParse({
    accountId: formData.get("accountId"),
    purpose: formData.get("purpose"),
    action: formData.get("action"),
    requestReference: formData.get("requestReference") ?? "",
  });
  if (!parsed.success) {
    return {
      error:
        "Izaberite svrhu i odluku, i unesite referencu na zahtev (najmanje 3 znaka).",
      ok: null,
    };
  }

  let result: { recorded: boolean; reason: string | null };
  try {
    result = await recordOfflineConsentDecision(
      {
        customerUserId: parsed.data.accountId,
        purpose: parsed.data.purpose,
        action: parsed.data.action,
        requestReference: parsed.data.requestReference,
      },
      { kind: "staff", id: actor.id, name: actor.name, role: actor.role },
    );
  } catch (error) {
    if (error instanceof ConsentError) return { error: error.message, ok: null };
    throw error;
  }

  revalidatePath("/portal/kupci/nalozi");
  return {
    error: null,
    ok: result.recorded
      ? parsed.data.action === "withdrawn"
        ? "Povlačenje saglasnosti je evidentirano. Nalog, cene i prijava ostaju nepromenjeni."
        : "Pristanak je evidentiran."
      : (result.reason ?? "Stanje je već takvo."),
  };
}

const verifySchema = z.object({
  accountId: z.string().uuid(),
  basisIdentifierId: z.string().uuid(),
  method: z.enum(["callback_known_number", "signed_authorization", "in_person"]),
  contactSource: z.enum([
    "biznisoft_partner_record",
    "provided_by_company",
    "provided_by_sales_rep",
    "public_business_listing",
  ]),
  sourceReference: z.string().trim().max(500).optional(),
  personRole: z.string().trim().min(2).max(120),
  evidenceNote: z.string().trim().min(15).max(1000),
});

/**
 * Potvrda da osoba sme da vidi podatke firme — preduslov poziva (0028).
 *
 * Kapija je `customer_accounts:manage`: potvrdu beleži kancelarija ili gazda,
 * ne komercijalista koji je kontakt predložio.
 */
export async function verifyContactAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability("customer_accounts:manage", "/portal/kupci/nalozi");
  const parsed = verifySchema.safeParse({
    accountId: formData.get("accountId"),
    basisIdentifierId: formData.get("basisIdentifierId"),
    method: formData.get("method"),
    contactSource: formData.get("contactSource"),
    sourceReference: formData.get("sourceReference") || undefined,
    personRole: formData.get("personRole") ?? "",
    evidenceNote: formData.get("evidenceNote") ?? "",
  });
  if (!parsed.success) {
    return {
      error:
        "Proverite unos: šifra partnera, način potvrde, izvor kontakta, funkcija osobe i beleška o dokazu (najmanje 15 znakova).",
      ok: null,
    };
  }
  try {
    await verifyCustomerContact(parsed.data, { id: actor.id, name: actor.name, role: actor.role });
  } catch (error) {
    if (error instanceof CustomerAccountError) return { error: error.message, ok: null };
    throw error;
  }
  revalidatePath("/portal/kupci/nalozi");
  return { error: null, ok: "Osoba je potvrđena. Poziv se sada može izdati." };
}

const revokeSchema = z.object({
  accountId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Opoziv pristupa: potvrda, otvoreni pozivi i sesije padaju zajedno.
 * Koristi se i pri promeni kontakt osobe.
 */
export async function revokeAccessAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await requireCapability("customer_accounts:manage", "/portal/kupci/nalozi");
  const parsed = revokeSchema.safeParse({
    accountId: formData.get("accountId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "Unesite razlog opoziva (najmanje 3 znaka).", ok: null };
  try {
    await revokeCustomerAccess(parsed.data, { id: actor.id, name: actor.name, role: actor.role });
  } catch (error) {
    if (error instanceof CustomerAccountError) return { error: error.message, ok: null };
    throw error;
  }
  revalidatePath("/portal/kupci/nalozi");
  return {
    error: null,
    ok: "Pristup je opozvan: potvrda i otvoreni pozivi su poništeni, sesije prekinute.",
  };
}
