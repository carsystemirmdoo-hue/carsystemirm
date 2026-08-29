"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ExternalIdentityError,
  resolveExternalIdentifier,
} from "@/lib/commercial/identity-service";
import { requireCapability } from "@/lib/authz/session";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerExternalIdentifiers } from "@/db/schema";
import { postAwaitingMapping } from "@/lib/pdf/ingest";

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

  /*
   * Povezivanje šifre odmah knjiži dokumente koji su na nju čekali.
   *
   * Bez ovoga bi promet stajao nevidljiv sve dok neko ne pokrene poseban
   * korak — a taj korak niko ne bi znao da treba da pokrene. Knjiženje ne
   * odlučuje ništa novo: čita sačuvane stavke i primenjuje odluku koja je
   * upravo doneta.
   */
  let posted = 0;
  if (parsed.data.status === "mapped") {
    const identity = await identityKeyOf(parsed.data.id);
    if (identity) {
      const outcome = await postAwaitingMapping(identity, {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      });
      posted = outcome.posted.length;
    }
  }

  revalidatePath("/portal/kupci/mapiranja");
  revalidatePath("/portal/importi/dokumenti");
  return {
    error: null,
    ok:
      posted > 0
        ? `Šifra partnera je razrešena. Proknjiženo dokumenata: ${posted}.`
        : "Šifra partnera je razrešena.",
  };
}

/** Ključ (izdavalac, šifra) za razrešenu šifru; `null` ako reda nema. */
async function identityKeyOf(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      issuerCode: customerExternalIdentifiers.issuerCode,
      externalPartnerCode: customerExternalIdentifiers.externalPartnerCode,
    })
    .from(customerExternalIdentifiers)
    .where(eq(customerExternalIdentifiers.id, id))
    .limit(1);
  return rows[0] ?? null;
}
