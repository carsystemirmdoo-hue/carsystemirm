"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import {
  reconcileOfficeRecorded,
  reconcilePriceRule,
} from "@/lib/pricing/reconciliation-service";

export type ReconciliationState = {
  error: string | null;
  ok: string | null;
  /** Zbir po ishodima. Bez naziva kupca i bez ijednog iznosa. */
  results: { outcome: string; count: number }[];
};

/**
 * Pokretanje usaglašavanja svih pravila koja čekaju.
 *
 * Radnja traži `prices:apply` — istu dozvolu koja sme da evidentira upis u
 * BizniSoft. To NIJE dozvola da se pravilo potvrdi: ishod određuje faktura, a
 * pozivalac ne može uticati na njega.
 */
export async function reconcileAction(
  _previous: ReconciliationState,
  formData: FormData,
): Promise<ReconciliationState> {
  const user = await requireCapability("prices:apply", "/portal/cene/pravila");
  const actor = { id: user.id, name: user.name, role: user.role };

  /*
   * Jedno pravilo ili sva koja čekaju.
   *
   * Ista radnja pokriva oba jer je nalaz isti — razlika je samo u tome koliko
   * se pravila proverava. Odvojena radnja za pojedinačno pravilo bi značila
   * drugu kopiju istog pravila potvrde.
   */
  const ruleId = String(formData.get("ruleId") || "").trim();
  const { results } = ruleId
    ? { results: [await reconcilePriceRule(ruleId, actor)] }
    : await reconcileOfficeRecorded(actor);

  const tally = new Map<string, number>();
  for (const row of results) {
    tally.set(row.outcome, (tally.get(row.outcome) ?? 0) + 1);
  }

  revalidatePath("/portal/cene/pravila");
  revalidatePath("/portal/cene/istorija");

  return {
    error: null,
    ok: `Provereno pravila: ${results.length}.`,
    results: [...tally.entries()].map(([outcome, count]) => ({ outcome, count })),
  };
}
