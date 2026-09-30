"use server";

import { revalidatePath } from "next/cache";
import { recomputeAction, type RecomputeState } from "@/app/portal/preporuke/actions";
import { requireCapability } from "@/lib/authz/session";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * „Preračunaj sada" sa radne liste.
 *
 * Ne zaobilazi ništa: poziva ISTU akciju kao ekran preporuka — ista
 * sposobnost (`recommendations:recompute`), isti prekidač, isto ograničenje
 * učestalosti, isti opseg pozivaoca. Jedina razlika je datum: današnji dan u
 * Beogradu, jer radna lista uvek govori o danas.
 */
export async function recomputeTodayAction(
  previous: RecomputeState,
  formData: FormData,
): Promise<RecomputeState> {
  // Kapija u sopstvenom telu (lib/authz/enrollmentIsolation.test.mjs), iako je
  // ponavlja i pozvana akcija.
  await requireCapability("recommendations:recompute", "/portal/za-razgovor");
  void formData;
  const form = new FormData();
  form.set("asOfDate", belgradeDate(new Date()));
  const result = await recomputeAction(previous, form);
  revalidatePath("/portal/za-razgovor");
  revalidatePath("/portal/kupci", "layout");
  return result;
}
