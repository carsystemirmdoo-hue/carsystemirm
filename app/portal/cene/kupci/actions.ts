"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { RebateSheetError, saveRebateChanges, setNoticeRead, type SaveInput, type SaveResult } from "@/lib/pricing/customer-rebate-service";

/*
 * Cene po kupcu — serverske radnje. Server SAM proverava ovlašćenje (uloga + dodela kupca) i ponovo
 * računa rabat iz VP cene na dan važenja; podatak iz pregledača se ne uzima kao gotov.
 */

export type SaveRebatesState =
  | { ok: true; result: SaveResult }
  | { ok: false; code: string; message: string; details: { articleId: string; option: string | null; message: string }[] };

export async function saveRebatesAction(input: SaveInput): Promise<SaveRebatesState> {
  const actor = await requireCapability("rebates:edit", "/portal/cene/kupci");
  try {
    const result = await saveRebateChanges(actor, {
      customerId: String(input?.customerId ?? ""),
      items: Array.isArray(input?.items)
        ? input.items.map((i) => ({ articleId: String(i.articleId), option: i.option === null ? null : String(i.option), field: i.field === "c" ? "c" : "r", value: String(i.value ?? "").slice(0, 32) }))
        : [],
      period: { kind: input?.period?.kind === "akcija" ? "akcija" : input?.period?.kind === "datum" ? "datum" : "sada", from: input?.period?.from ?? null, to: input?.period?.to ?? null },
      replaceConfirmed: input?.replaceConfirmed === true,
      note: typeof input?.note === "string" ? input.note : null,
    });
    revalidatePath(`/portal/cene/kupci/${input.customerId}`);
    revalidatePath("/portal/cene/obavestenja");
    return { ok: true, result };
  } catch (error) {
    if (error instanceof RebateSheetError) {
      return { ok: false, code: error.code, message: error.message, details: Array.isArray(error.details) ? (error.details as { articleId: string; option: string | null; message: string }[]) : [] };
    }
    console.error("[cene-kupca] čuvanje nije uspelo", (error as Error)?.name);
    return { ok: false, code: "greska", message: "Čuvanje nije uspelo. Ništa nije sačuvano — izmene su i dalje u tabeli, pokušajte ponovo.", details: [] };
  }
}

export async function markNoticeAction(formData: FormData) {
  const user = await requireCapability("rebates:edit", "/portal/cene/obavestenja");
  await setNoticeRead(user, String(formData.get("id") ?? ""), formData.get("procitano") === "da");
  revalidatePath("/portal/cene/obavestenja");
}
