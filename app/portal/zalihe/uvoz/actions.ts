"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfaOrReauth } from "@/lib/authz/session";
import { formatMegabytes } from "@/lib/import/upload-limits.mjs";
import { MAX_STOCK_FILE_BYTES } from "@/lib/stock/readStockFile.mjs";
import { confirmStockImport, discardStockImport, StockImportError, uploadStockReport } from "@/lib/stock/stock-import-service";

/*
 * Lager — serverske akcije (dok. 65). Svaka SAMA proverava `imports:write` (vlasnik i
 * kancelarija); skriveno dugme nije ovlašćenje. Otpremanje samo čita fajl i upisuje ga
 * za pregled. Potvrda i odbacivanje traže i SVEŽU potvrdu drugog faktora; kada je
 * zastarela, korisnik ide na ponovnu potvrdu identiteta i vraća se na isti uvoz.
 * Ponovljen klik posle odluke ne menja ništa: prikazuje se već zapisani ishod.
 */
const PATH = "/portal/zalihe/uvoz";

export type StockImportActionState = { error: string | null; ok: string | null };

function sameActor<T extends Parameters<typeof can>[0] & { id: string }>(actor: { id: string }, fresh: T): T {
  if (fresh.id !== actor.id || !can(fresh, "imports:write")) forbidden();
  return fresh;
}

/** Povratak posle ponovne potvrde identiteta: isti uvoz. */
const decisionPath = (importId: string) => (UUID.test(importId) ? `${PATH}/${importId}?identitet=potvrdjen` : PATH);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const message = (error: unknown) => (error instanceof StockImportError ? error.message : null);
/** Odluka je već zapisana (npr. drugi klik): ništa se ne ponavlja, prikazuje se zapisani ishod. */
const decided = (error: unknown) => error instanceof StockImportError && error.code === "odluceno";

export async function uploadStockAction(_prev: StockImportActionState, formData: FormData): Promise<StockImportActionState> {
  const actor = await requireCapability("imports:write", PATH);
  const file = formData.get("lager");
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite XLSX ili CSV izvoz lagera.", ok: null };
  if (file.size > MAX_STOCK_FILE_BYTES) return { error: `Fajl je veći od ${formatMegabytes(MAX_STOCK_FILE_BYTES)}.`, ok: null };
  let importId: string;
  let duplicate = false;
  let olderParser = false;
  try {
    const result = await uploadStockReport(actor, { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    importId = result.importId;
    duplicate = result.duplicate;
    olderParser = Boolean(result.failedWithOlderParser);
  } catch (error) {
    const m = message(error);
    if (m) return { error: `Lager nije prihvaćen: ${m}`, ok: null };
    console.error("[lager] otpremanje nije uspelo", (error as Error)?.name);
    return { error: "Otpremanje nije uspelo. Ništa nije upisano; pokušajte ponovo.", ok: null };
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${importId}${olderParser ? "?isti=1&raniji=1" : duplicate ? "?isti=1" : ""}`);
}

export async function confirmStockAction(_prev: StockImportActionState, formData: FormData): Promise<StockImportActionState> {
  const importId = String(formData.get("importId") ?? "");
  const back = decisionPath(importId);
  // Svež drugi faktor istog korisnika sa istim pravom; inače ponovna potvrda sa povratkom na uvoz.
  const actor = sameActor(await requireCapability("imports:write", back), await requireRecentMfaOrReauth(back));
  if (formData.get("potvrda") !== "da") return { error: "Potvrdite da ste pregledali izveštaj.", ok: null };
  try {
    await confirmStockImport(actor, { importId, note: String(formData.get("napomena") ?? "") });
  } catch (error) {
    if (decided(error)) redirect(`${PATH}/${importId}?ishod=vec-odluceno`);
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
  revalidatePath(PATH);
  revalidatePath("/portal/zalihe");
  // Posle odluke forma više ne postoji na strani; ishod nosi adresa.
  redirect(`${PATH}/${importId}?ishod=potvrdjeno`);
}

export async function discardStockAction(_prev: StockImportActionState, formData: FormData): Promise<StockImportActionState> {
  const importId = String(formData.get("importId") ?? "");
  const back = decisionPath(importId);
  // Svež drugi faktor istog korisnika sa istim pravom; inače ponovna potvrda sa povratkom na uvoz.
  const actor = sameActor(await requireCapability("imports:write", back), await requireRecentMfaOrReauth(back));
  try {
    await discardStockImport(actor, { importId, note: String(formData.get("razlog") ?? "") });
  } catch (error) {
    if (decided(error)) redirect(`${PATH}/${importId}?ishod=vec-odluceno`);
    const m = message(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${importId}?ishod=odbaceno`);
}
