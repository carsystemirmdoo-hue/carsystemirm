"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { previewRebateChange, RebateChangeError, submitRebateChange, type ChangeInput } from "@/lib/pricing/rebate-change-service";
import { WorkflowError, PricingRuleError } from "@/lib/pricing/rule-service";

/*
 * Promena rabata sa strane kupca: pregled (ne upisuje) i slanje. Obe akcije
 * same proveravaju dozvolu i opseg kupca; ulaz iz pregledača se ne veruje —
 * servis ponovo računa pregled i odbija ako se stanje promenilo.
 */
const UUID = /^[0-9a-f-]{36}$/;

function clean(input: ChangeInput): ChangeInput {
  return {
    customerId: String(input.customerId),
    mode: input.mode === "grupa" ? "grupa" : "artikli",
    articleIds: (input.articleIds ?? []).filter((id) => UUID.test(id)).slice(0, 2000),
    groupKey: input.groupKey ? String(input.groupKey).slice(0, 80) : undefined,
    newPercent: Number(String(input.newPercent).replace(",", ".")),
    effectiveFrom: String(input.effectiveFrom),
    includeExceptions: (input.includeExceptions ?? []).filter((id) => UUID.test(id)).slice(0, 2000),
    paymentCondition: input.paymentCondition === "kratak_rok" ? "kratak_rok" : null,
  };
}

const message = (error: unknown) =>
  error instanceof RebateChangeError || error instanceof WorkflowError || error instanceof PricingRuleError ? error.message : null;

export async function previewChangeAction(input: ChangeInput) {
  const user = await requireCapability("prices:propose", `/portal/cene/rabati-iz-faktura/kupci/${input.customerId}`);
  try {
    return { ok: true as const, preview: await previewRebateChange(user, clean(input)) };
  } catch (error) {
    const m = message(error);
    if (m) return { ok: false as const, error: m };
    throw error;
  }
}

export async function submitChangeAction(
  input: ChangeInput & { reason: string; expected: { articleId: string; replacesRuleId: string | null }[]; approveNow?: boolean },
) {
  const user = await requireCapability("prices:propose", `/portal/cene/rabati-iz-faktura/kupci/${input.customerId}`);
  try {
    const r = await submitRebateChange(user, {
      ...clean(input),
      reason: String(input.reason ?? ""),
      expected: (input.expected ?? []).filter((e) => UUID.test(e.articleId)).map((e) => ({ articleId: e.articleId, replacesRuleId: e.replacesRuleId && UUID.test(e.replacesRuleId) ? e.replacesRuleId : null })),
      approveNow: Boolean(input.approveNow),
    });
    revalidatePath(`/portal/cene/rabati-iz-faktura/kupci/${input.customerId}`);
    return {
      ok: true as const,
      message: r.approved
        ? `Odobreno: ${r.count} pravila važe od ${input.effectiveFrom} (serija ${r.batchId}).`
        : `Poslato na odobrenje: ${r.count} predloga. Cena se ne menja dok ih vlasnik ne odobri.`,
    };
  } catch (error) {
    const m = message(error);
    if (m) return { ok: false as const, error: m };
    throw error;
  }
}
