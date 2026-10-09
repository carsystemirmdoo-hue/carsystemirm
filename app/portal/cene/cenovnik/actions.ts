"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfa } from "@/lib/authz/session";
import { MAX_UPLOAD_FILE_BYTES, formatMegabytes } from "@/lib/import/upload-limits.mjs";
import { applyPriceList, discardPriceList, PriceListError, setBasePrice, uploadPriceList } from "@/lib/pricing/price-list-service";

/*
 * Cenovnik — serverske akcije. Svaka SAMA proverava `pricelist:manage` (samo
 * gazda); skriveno dugme nije ovlašćenje. Upis osnovnih cena (primena, ručna
 * izmena) i odbacivanje traže i SVEŽU potvrdu drugog faktora i izričitu
 * potvrdu u formi. Otpremanje samo čita PDF i upisuje ga za pregled.
 */
const PATH = "/portal/cene/cenovnik";

export type PriceListActionState = { error: string | null; ok: string | null };

/** Akter iz sveže MFA sesije mora biti isti korisnik i i dalje imati sposobnost. */
function sameOwner<T extends Parameters<typeof can>[0] & { id: string }>(actor: { id: string }, fresh: T): T {
  if (fresh.id !== actor.id || !can(fresh, "pricelist:manage")) forbidden();
  return fresh;
}

const message = (error: unknown) => (error instanceof PriceListError ? error.message : null);

export async function uploadPriceListAction(_prev: PriceListActionState, formData: FormData): Promise<PriceListActionState> {
  const actor = await requireCapability("pricelist:manage", PATH);
  const file = formData.get("cenovnik");
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite PDF cenovnika.", ok: null };
  if (file.size > MAX_UPLOAD_FILE_BYTES) return { error: `Fajl je veći od ${formatMegabytes(MAX_UPLOAD_FILE_BYTES)}.`, ok: null };
  let importId: string;
  try {
    const result = await uploadPriceList(actor, { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    importId = result.importId;
  } catch (error) {
    const m = message(error);
    if (m) return { error: `Cenovnik nije prihvaćen: ${m}`, ok: null };
    console.error("[cenovnik] otpremanje nije uspelo", (error as Error)?.name);
    return { error: "Otpremanje nije uspelo. Ništa nije upisano; pokušajte ponovo.", ok: null };
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${importId}`);
}

export async function applyPriceListAction(_prev: PriceListActionState, formData: FormData): Promise<PriceListActionState> {
  const actor = sameOwner(await requireCapability("pricelist:manage", PATH), await requireRecentMfa());
  const importId = String(formData.get("importId") ?? "");
  if (formData.get("potvrda") !== "da") return { error: "Potvrdite da ste pregledali promene i da primena menja osnovne cene.", ok: null };
  try {
    const r = await applyPriceList(actor, {
      importId,
      validFrom: String(formData.get("vaziOd") ?? ""),
      confirmedUnclearCodes: formData.getAll("nejasno").map(String).filter((c) => /^[0-9A-Za-z./_-]{1,32}$/.test(c)),
      note: String(formData.get("napomena") ?? ""),
    });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${importId}`);
    return { error: null, ok: `Primenjeno: ${r.applied} osnovnih cena.` };
  } catch (error) {
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
}

export async function discardPriceListAction(_prev: PriceListActionState, formData: FormData): Promise<PriceListActionState> {
  const actor = sameOwner(await requireCapability("pricelist:manage", PATH), await requireRecentMfa());
  const importId = String(formData.get("importId") ?? "");
  try {
    await discardPriceList(actor, { importId, note: String(formData.get("razlog") ?? "") });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${importId}`);
    return { error: null, ok: "Cenovnik je odbačen; osnovne cene nisu menjane." };
  } catch (error) {
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
}

export async function setBasePriceAction(_prev: PriceListActionState, formData: FormData): Promise<PriceListActionState> {
  const actor = sameOwner(await requireCapability("pricelist:manage", PATH), await requireRecentMfa());
  if (formData.get("potvrda") !== "da") return { error: "Potvrdite izmenu osnovne cene.", ok: null };
  try {
    const r = await setBasePrice(actor, {
      articleCode: String(formData.get("sifra") ?? ""),
      price: String(formData.get("cena") ?? ""),
      validFrom: String(formData.get("vaziOd") ?? ""),
      reason: String(formData.get("obrazlozenje") ?? ""),
      vatPercent: String(formData.get("pdv") ?? "") || null,
    });
    revalidatePath(PATH);
    return { error: null, ok: `Osnovna cena ${r.netPrice} važi od ${r.validFrom}.` };
  } catch (error) {
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
}
