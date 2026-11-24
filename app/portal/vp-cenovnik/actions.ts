"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/authz/session";
import { MAX_UPLOAD_FILE_BYTES, formatMegabytes } from "@/lib/import/upload-limits.mjs";
import {
  createVpDraftFromExcel,
  discardVpDraft,
  returnVpDraft,
  saveVpDraft,
  sendVpDraftToOffice,
  sendVpDraftToOwner,
  VpDraftError,
} from "@/lib/pricing/vp-draft-service";

/*
 * VP cenovnik — priprema (0066). Svaka akcija SAMA proverava sposobnost (servis još jednom);
 * skriveno dugme nije ovlašćenje. Nijedna akcija ne menja osnovnu cenu — primena ostaje kod
 * vlasnika na strani Cenovnik (drugi faktor, datum važenja).
 */
const PATH = "/portal/vp-cenovnik";

export type VpActionState = { error: string | null; ok: string | null };

const known = (error: unknown) => (error instanceof VpDraftError ? error.message : null);

export async function saveVpDraftAction(input: {
  id: string | null;
  title: string;
  proposedValidFrom: string | null;
  note: string;
  edits: unknown;
  rounding: string;
  sendToOffice?: boolean;
}): Promise<{ ok: true; id: string; message: string } | { ok: false; error: string }> {
  const actor = await requireCapability("pricelist:prepare", PATH);
  try {
    const r = await saveVpDraft(actor, input);
    if (input.sendToOffice) await sendVpDraftToOffice(actor, r.id, null);
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${r.id}`);
    const ignored = r.ignored ? ` ${r.ignored} artikala bez važeće cene nije menjano procentom.` : "";
    return {
      ok: true,
      id: r.id,
      message: input.sendToOffice ? `Poslato kancelariji: ${r.changed} promenjenih cena.${ignored}` : `Sačuvano: ${r.changed} promenjenih cena.${ignored}`,
    };
  } catch (error) {
    const m = known(error);
    if (m) return { ok: false, error: m };
    console.error("[vp-cenovnik] čuvanje nije uspelo", (error as Error)?.name);
    return { ok: false, error: "Čuvanje nije uspelo. Ništa nije upisano; pokušajte ponovo." };
  }
}

export async function uploadVpExcelAction(_prev: VpActionState, formData: FormData): Promise<VpActionState> {
  const actor = await requireCapability("pricelist:prepare", PATH);
  const file = formData.get("fajl");
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite Excel fajl (.xlsx).", ok: null };
  if (file.size > MAX_UPLOAD_FILE_BYTES) return { error: `Fajl je veći od ${formatMegabytes(MAX_UPLOAD_FILE_BYTES)}.`, ok: null };
  let id: string;
  try {
    const r = await createVpDraftFromExcel(actor, { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), title: String(formData.get("naziv") ?? "") });
    id = r.id;
  } catch (error) {
    const m = known(error);
    if (m) return { error: m, ok: null };
    console.error("[vp-cenovnik] Excel nije pročitan", (error as Error)?.name);
    return { error: "Excel nije pročitan. Ništa nije upisano; pokušajte ponovo.", ok: null };
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${id}`);
}

/**
 * Korak menja ekran (forma koraka nestaje), pa se posle uspeha ide na stranu pripreme sa
 * potvrdom u adresi; greška ostaje u formi.
 */
async function step(fn: () => Promise<unknown>, id: string, done: string): Promise<VpActionState> {
  try {
    await fn();
  } catch (error) {
    const m = known(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  redirect(`${PATH}/${id}?korak=${done}`);
}

export async function sendToOfficeAction(_prev: VpActionState, formData: FormData): Promise<VpActionState> {
  const actor = await requireCapability("pricelist:prepare", PATH);
  const id = String(formData.get("id") ?? "");
  return step(() => sendVpDraftToOffice(actor, id, String(formData.get("napomena") ?? "")), id, "kancelarija");
}

export async function returnDraftAction(_prev: VpActionState, formData: FormData): Promise<VpActionState> {
  const actor = await requireCapability("view:vp_cenovnik", PATH);
  const id = String(formData.get("id") ?? "");
  return step(() => returnVpDraft(actor, id, String(formData.get("napomena") ?? "")), id, "vraceno");
}

export async function sendToOwnerAction(_prev: VpActionState, formData: FormData): Promise<VpActionState> {
  const actor = await requireCapability("pricelist:office_check", PATH);
  const id = String(formData.get("id") ?? "");
  if (formData.get("provereno") !== "da") return { error: "Potvrdite da ste proverili stare i nove cene.", ok: null };
  return step(() => sendVpDraftToOwner(actor, id, String(formData.get("napomena") ?? "")), id, "vlasnik");
}

export async function discardDraftAction(_prev: VpActionState, formData: FormData): Promise<VpActionState> {
  const actor = await requireCapability("pricelist:prepare", PATH);
  const id = String(formData.get("id") ?? "");
  return step(() => discardVpDraft(actor, id), id, "odbaceno");
}
