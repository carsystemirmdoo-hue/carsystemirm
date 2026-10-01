"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import { formatMegabytes } from "@/lib/import/upload-limits.mjs";
import {
  AssignmentError,
  applyAssignmentPlan,
  linkSalespersonCode,
} from "@/lib/partners/assignment-service";
import { isPartnerRegistryUploadEnabled } from "@/lib/partners/gate";
import {
  linkPartnerToCustomer,
  PARTNER_FILE_MAX_BYTES,
  PartnerRegistryError,
  recordPartnerImport,
} from "@/lib/partners/partner-registry-service";
import { PartnerWorkbookError } from "@/lib/partners/partnerRegistry.mjs";
import { XlsxReadError } from "@/lib/import/xlsx/readXlsx.mjs";

export type RegistryActionState = { error: string | null; ok: string | null };

const PATH = "/portal/kupci/partneri";
const actorOf = (u: { id: string; name: string; role: string }) => ({ id: u.id, name: u.name, role: u.role });

function known(error: unknown): string | null {
  if (
    error instanceof PartnerRegistryError ||
    error instanceof PartnerWorkbookError ||
    error instanceof XlsxReadError ||
    error instanceof AssignmentError
  ) {
    return error.message;
  }
  return null;
}

/**
 * Uvoz snimka registra. Isključen dok `FEATURE_PARTNER_REGISTRY=1` nije
 * podešen: registar nosi e-poštu i telefone iz izvora, a oni ne ulaze u
 * produkcionu bazu dok vlasnik to ne odobri.
 */
export async function uploadRegistryAction(
  _previous: RegistryActionState,
  formData: FormData,
): Promise<RegistryActionState> {
  const actor = await requireCapability("mappings:manage", PATH);
  if (!isPartnerRegistryUploadEnabled()) {
    return { error: "Uvoz registra je isključen u ovom okruženju.", ok: null };
  }
  const file = formData.get("file");
  const issuerCode = String(formData.get("issuerCode") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite XLSX fajl.", ok: null };
  if (file.size > PARTNER_FILE_MAX_BYTES) {
    return { error: `Fajl je veći od ${formatMegabytes(PARTNER_FILE_MAX_BYTES)}.`, ok: null };
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(issuerCode)) return { error: "Unesite oznaku izdavaoca.", ok: null };
  try {
    const r = await recordPartnerImport(
      { fileName: file.name, bytes: Buffer.from(await file.arrayBuffer()), issuerCode },
      actorOf(actor),
    );
    revalidatePath(PATH);
    return {
      error: null,
      ok: r.duplicate
        ? "Isti fajl je već uvezen — ništa nije promenjeno."
        : `Uvezen snimak: ${String(r.summary.partners)} partnera. Ništa nije povezano ni pozvano automatski.`,
    };
  } catch (error) {
    const message = known(error);
    if (message) return { error: message, ok: null };
    throw error;
  }
}

const linkSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    issuerCode: z.string().trim().min(1).max(64),
    partnerCode: z.string().trim().min(1).max(64),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    mode: z.literal("attach"),
    issuerCode: z.string().trim().min(1).max(64),
    partnerCode: z.string().trim().min(1).max(64),
    customerId: z.string().uuid(),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export async function linkPartnerAction(
  _previous: RegistryActionState,
  formData: FormData,
): Promise<RegistryActionState> {
  const actor = await requireCapability("mappings:manage", PATH);
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Unesite razlog povezivanja (najmanje 3 znaka).", ok: null };
  try {
    const r = await linkPartnerToCustomer(parsed.data, actorOf(actor));
    revalidatePath(PATH);
    return r.conflict
      ? { error: `Veza je u sukobu: ${r.conflict}`, ok: null }
      : { error: null, ok: `Šifra ${parsed.data.partnerCode} je povezana sa kupcem.` };
  } catch (error) {
    const message = known(error);
    if (message) return { error: message, ok: null };
    throw error;
  }
}

const repSchema = z.object({
  sourceCode: z.string().trim().min(1).max(32),
  userId: z.string().uuid(),
});

export async function linkRepCodeAction(
  _previous: RegistryActionState,
  formData: FormData,
): Promise<RegistryActionState> {
  const actor = await requireCapability("assignments:manage", PATH);
  const parsed = repSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Izaberite komercijalistu.", ok: null };
  try {
    await linkSalespersonCode(parsed.data, actorOf(actor));
    revalidatePath(PATH);
    return { error: null, ok: `Šifra komercijaliste ${parsed.data.sourceCode} je povezana.` };
  } catch (error) {
    const message = known(error);
    if (message) return { error: message, ok: null };
    throw error;
  }
}

export async function applyPlanAction(
  _previous: RegistryActionState,
  formData: FormData,
): Promise<RegistryActionState> {
  const actor = await requireCapability("assignments:manage", PATH);
  const issuerCode = String(formData.get("issuerCode") ?? "").trim();
  if (!issuerCode) return { error: "Nedostaje izdavalac.", ok: null };
  const r = await applyAssignmentPlan(issuerCode, actorOf(actor));
  revalidatePath(PATH);
  return {
    error: null,
    ok: `Dodeljeno kupaca: ${r.granted}. Preskočeno šifara: ${r.skipped} (razlozi su u pregledu plana).`,
  };
}
