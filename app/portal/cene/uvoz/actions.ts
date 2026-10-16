"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfaOrReauth } from "@/lib/authz/session";
import { MAX_UPLOAD_FILE_BYTES, formatMegabytes } from "@/lib/import/upload-limits.mjs";
import { applyPriceList, discardPriceList, PriceListError, prepareTablePriceList, uploadPriceList, type NewArticleDecision } from "@/lib/pricing/price-list-service";

/*
 * Uvoz VP cenovnika (0057): gazda i kancelarija (`pricelist:import`). Menja SAMO osnovne cene; rabati kupaca
 * se ne prepisuju. Primena i odbacivanje traže svežu potvrdu drugog faktora i izričitu potvrdu u formi.
 */
const PATH = "/portal/cene/uvoz";

export type ImportState = { error: string | null; ok: string | null };

const message = (error: unknown) => (error instanceof PriceListError ? error.message : null);
const col = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < 100 ? Number(v) : null);

function sameUser<T extends Parameters<typeof can>[0] & { id: string }>(actor: { id: string }, fresh: T): T {
  if (fresh.id !== actor.id || !can(fresh, "pricelist:import")) forbidden();
  return fresh;
}

export async function prepareTableAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const actor = await requireCapability("pricelist:import", PATH);
  const file = formData.get("fajl");
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite fajl cenovnika (CSV ili XLSX).", ok: null };
  if (file.size > MAX_UPLOAD_FILE_BYTES) return { error: `Fajl je veći od ${formatMegabytes(MAX_UPLOAD_FILE_BYTES)}.`, ok: null };
  const unit = formData.get("jedinica");
  if (unit !== "jm" && unit !== "pak") return { error: "Izaberite da li je cena u fajlu po jedinici mere ili po pakovanju.", ok: null };
  const code = col(formData.get("kolSifra"));
  const price = col(formData.get("kolCena"));
  if (code === null || price === null) return { error: "Izaberite kolonu sa šifrom i kolonu sa novom VP cenom.", ok: null };
  let importId: string;
  let duplicate = false;
  try {
    const r = await prepareTablePriceList(actor, {
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      map: { header: formData.get("zaglavlje") === "da", code, price, name: col(formData.get("kolNaziv")), unit: col(formData.get("kolJm")), pack: col(formData.get("kolPak")) },
      priceUnit: unit,
    });
    importId = r.importId;
    duplicate = r.duplicate;
  } catch (error) {
    const m = message(error);
    if (m) return { error: `Cenovnik nije prihvaćen: ${m}`, ok: null };
    console.error("[uvoz-vp] priprema nije uspela", (error as Error)?.name);
    return { error: "Čitanje fajla nije uspelo. Ništa nije upisano; pokušajte ponovo.", ok: null };
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${importId}${duplicate ? "?isti=1" : ""}`);
}

export async function uploadPdfAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const actor = await requireCapability("pricelist:import", PATH);
  const file = formData.get("cenovnik");
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite PDF cenovnika.", ok: null };
  if (file.size > MAX_UPLOAD_FILE_BYTES) return { error: `Fajl je veći od ${formatMegabytes(MAX_UPLOAD_FILE_BYTES)}.`, ok: null };
  let importId: string;
  let duplicate = false;
  try {
    const r = await uploadPriceList(actor, { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    importId = r.importId;
    duplicate = r.duplicate;
  } catch (error) {
    const m = message(error);
    if (m) return { error: `Cenovnik nije prihvaćen: ${m}`, ok: null };
    console.error("[uvoz-vp] PDF nije pročitan", (error as Error)?.name);
    return { error: "Otpremanje nije uspelo. Ništa nije upisano; pokušajte ponovo.", ok: null };
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${importId}${duplicate ? "?isti=1" : ""}`);
}

const CODE = /^[0-9A-Za-z./_-]{1,32}$/;

export async function applyImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const importId = String(formData.get("importId") ?? "");
  const actor = sameUser(await requireCapability("pricelist:import", PATH), await requireRecentMfaOrReauth(`${PATH}/${importId}`));
  if (formData.get("potvrda") !== "da") return { error: "Potvrdite da ste pregledali promene i da primena menja samo VP cene.", ok: null };
  const newArticles: NewArticleDecision[] = [];
  for (const c of formData.getAll("noviKod").map(String).filter((x) => CODE.test(x))) {
    const mode = String(formData.get(`odluka:${c}`) ?? "preskoci");
    if (mode === "novi") {
      newArticles.push({
        code: c,
        mode: "novi",
        name: String(formData.get(`naziv:${c}`) ?? ""),
        unit: String(formData.get(`jm:${c}`) ?? ""),
        packLabel: String(formData.get(`pak:${c}`) ?? ""),
        packQuantity: String(formData.get(`kol:${c}`) ?? ""),
        productGroup: String(formData.get(`grupa:${c}`) ?? "") || null,
      });
    } else if (mode === "povezi") {
      newArticles.push({ code: c, mode: "povezi", articleCode: String(formData.get(`veza:${c}`) ?? "").trim() });
    }
  }
  try {
    const r = await applyPriceList(actor, {
      importId,
      validFrom: String(formData.get("vaziOd") ?? ""),
      confirmedUnclearCodes: formData.getAll("nejasno").map(String).filter((c) => CODE.test(c)),
      note: String(formData.get("napomena") ?? ""),
      newArticles,
    });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${importId}`);
    return { error: null, ok: `Primenjeno: ${r.applied} VP cena${r.created ? `, ${r.created} novih artikala (rabat 30 %)` : ""}${r.linked ? `, ${r.linked} izričito povezanih šifara` : ""}. Rabati kupaca nisu menjani.` };
  } catch (error) {
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
}

export async function discardImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const importId = String(formData.get("importId") ?? "");
  const actor = sameUser(await requireCapability("pricelist:import", PATH), await requireRecentMfaOrReauth(`${PATH}/${importId}`));
  try {
    await discardPriceList(actor, { importId, note: String(formData.get("razlog") ?? "") });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${importId}`);
    return { error: null, ok: "Cenovnik je odbačen; VP cene nisu menjane." };
  } catch (error) {
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
}
