"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { evaluateRebateArticles } from "@/lib/pricing/rebate-application-service";
import { loadRebateReview } from "@/lib/pricing/rebate-review-service";
import { proposePriceRule, PricingRuleError, WorkflowError } from "@/lib/pricing/rule-service";

export type ProposeChangeState = { ok: string | null; error: string | null };

const schema = z
  .object({
    customerId: z.string().uuid(),
    articleId: z.string().uuid(),
    discountPercent: z.coerce.number().min(0).max(100),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    reason: z.string().trim().min(10, "Obrazloženje: najmanje 10 znakova.").max(800),
  })
  .refine((v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, { message: "„Do“ je pre „Od“." });

/**
 * Predlog promene rabata kupac–artikal sa ekrana pregleda.
 *
 * Ide kroz postojeći `proposePriceRule`: on ponovo proverava `prices:propose`
 * i opseg kupca (komercijalista samo dodeljene). Dokaz iz istorije se računa
 * OVDE, iz baze — ne prihvata se iz pregledača — i dopisuje se u obrazloženje.
 * Predlog ne menja cenu dok ga vlasnik ne odobri.
 */
export async function proposeChangeAction(_prev: ProposeChangeState, form: FormData): Promise<ProposeChangeState> {
  const user = await requireCapability("prices:propose", "/portal/cene/rabati-iz-faktura/kupci");
  const parsed = schema.safeParse({
    customerId: form.get("customerId"),
    articleId: form.get("articleId"),
    discountPercent: String(form.get("discountPercent") ?? "").replace(",", "."),
    effectiveFrom: form.get("effectiveFrom"),
    effectiveTo: (form.get("effectiveTo") as string) || null,
    reason: form.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: null, error: parsed.error.issues[0]?.message ?? "Proverite polja." };
  const v = parsed.data;

  const review = await loadRebateReview(user, v.customerId);
  if (!review) return { ok: null, error: "Kupac nije u Vašem opsegu — predlog nije moguć." };
  const today = belgradeDate(new Date());
  const article = (await evaluateRebateArticles(user, today, v.customerId)).find((e) => e.articleId === v.articleId);
  if (!article) return { ok: null, error: "Artikal nije na fakturama ovog kupca." };

  const run = article.result.invoices.slice(-5).map((i) => `${i.documentLabel} (${i.issuedOn}, ${i.percent ?? i.values.join("/")} %)`);
  const reason = [
    v.reason,
    `Istorija (portal): ${article.result.reason}. Poslednje fakture: ${run.join(", ")}.`,
    `Pregled: /portal/cene/rabati-iz-faktura/kupci/${v.customerId}`,
  ].join(" — ").slice(0, 1500);

  try {
    await proposePriceRule(
      {
        customerScope: "customer",
        customerId: v.customerId,
        productScope: "article",
        articleId: v.articleId,
        valueKind: "discount_percent",
        discountPercent: v.discountPercent,
        effectiveFrom: v.effectiveFrom,
        effectiveTo: v.effectiveTo,
        reason,
      },
      user,
    );
  } catch (error) {
    if (error instanceof WorkflowError || error instanceof PricingRuleError) return { ok: null, error: error.message };
    throw error;
  }
  revalidatePath(`/portal/cene/rabati-iz-faktura/kupci/${v.customerId}`);
  return { ok: `Predlog za ${article.articleCode}: ${v.discountPercent} % je poslat na odobrenje. Cena se ne menja dok ga vlasnik ne odobri.`, error: null };
}
