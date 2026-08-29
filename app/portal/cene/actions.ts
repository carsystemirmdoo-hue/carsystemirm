"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import {
  PricingRuleError,
  proposePriceRule,
  transitionPriceRule,
  WorkflowError,
} from "@/lib/pricing/rule-service";

export type PriceActionState = { error: string | null; ok: string | null };

const optionalId = z
  .string()
  .uuid()
  .nullable()
  .catch(null);

const proposeSchema = z
  .object({
    customerScope: z.enum(["customer", "group", "all"]),
    customerId: optionalId,
    customerGroupId: optionalId,
    productScope: z.enum(["article", "product_group", "brand", "all"]),
    articleId: optionalId,
    productGroup: z.string().trim().max(120).nullable(),
    brand: z.string().trim().max(120).nullable(),
    valueKind: z.enum(["discount_percent", "net_price"]),
    discountPercent: z.number().min(0).max(100).nullable(),
    netPrice: z.number().min(0).nullable(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = optionalString(value);
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Predlog pravila cene.
 *
 * Predlog uvek završava u `pending_approval` — nikad odmah aktivan. Kapija je
 * `prices:propose`, a opseg kupca se dodatno proverava u servisu, protiv
 * dodeljenih kupaca.
 */
export async function proposeRuleAction(
  _previous: PriceActionState,
  formData: FormData,
): Promise<PriceActionState> {
  const actor = await requireCapability("prices:propose", "/portal/cene/pravila");

  const parsed = proposeSchema.safeParse({
    customerScope: formData.get("customerScope"),
    customerId: optionalString(formData.get("customerId")),
    customerGroupId: optionalString(formData.get("customerGroupId")),
    productScope: formData.get("productScope"),
    articleId: optionalString(formData.get("articleId")),
    productGroup: optionalString(formData.get("productGroup")),
    brand: optionalString(formData.get("brand")),
    valueKind: formData.get("valueKind"),
    discountPercent: optionalNumber(formData.get("discountPercent")),
    netPrice: optionalNumber(formData.get("netPrice")),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveTo: optionalString(formData.get("effectiveTo")),
    reason: formData.get("reason") ?? "",
  });

  if (!parsed.success) {
    return {
      error:
        "Proverite unos: opseg, vrednost, datum početka i razlog (najmanje 3 znaka).",
      ok: null,
    };
  }

  try {
    await proposePriceRule(parsed.data, actor);
  } catch (error) {
    if (error instanceof WorkflowError || error instanceof PricingRuleError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }

  revalidatePath("/portal/cene/pravila");
  revalidatePath("/portal/cene/odobravanje");
  return {
    error: null,
    ok: "Predlog je poslat na odobrenje. Predlog ne utiče na cenu dok ne bude odobren.",
  };
}

const transitionSchema = z.object({
  ruleId: z.string().uuid(),
  /*
   * `confirmed` i `reconciliation_failed` NISU u spisku.
   *
   * Prva odbrana: schema ih ne prihvata, pa ni ručno sastavljen POST ne prolazi.
   * Druga: `rejectTransition` traži `actorKind: "system"`. Treća: baza traži
   * `reconciled_invoice_id`. Tri nezavisna sloja, jer je ovo tvrdnja o novcu.
   */
  to: z.enum([
    "approved_pending_biznisoft",
    "office_recorded",
    "rejected",
    "revoked",
    "expired",
  ]),
  reason: z.string().trim().max(500).nullable(),
  officeRecordNote: z.string().trim().max(500).nullable(),
});

export async function transitionRuleAction(
  _previous: PriceActionState,
  formData: FormData,
): Promise<PriceActionState> {
  // Kapija je namerno šira od jedne sposobnosti: koja je tačno potrebna zavisi
  // od prelaza, i odlučuje `rejectTransition`, da pravilo živi na jednom mestu.
  const actor = await requireCapability("view:cene", "/portal/cene/odobravanje");

  const parsed = transitionSchema.safeParse({
    ruleId: formData.get("ruleId"),
    to: formData.get("to"),
    reason: optionalString(formData.get("reason")),
    officeRecordNote: optionalString(formData.get("officeRecordNote")),
  });
  if (!parsed.success) return { error: "Radnja nije prepoznata.", ok: null };

  try {
    await transitionPriceRule(parsed.data, actor);
  } catch (error) {
    if (error instanceof WorkflowError) return { error: error.message, ok: null };
    throw error;
  }

  revalidatePath("/portal/cene/odobravanje");
  revalidatePath("/portal/cene/istorija");
  revalidatePath("/portal/obavestenja");
  return { error: null, ok: "Stanje pravila je promenjeno." };
}
