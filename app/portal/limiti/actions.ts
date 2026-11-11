"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/authz/session";
import { CreditError, setCreditLimit, setDefaultCreditPercent } from "@/lib/credit/credit-service";

export type LimitActionResult = { ok: boolean; text: string } | null;

const LimitInput = z.object({
  customerId: z.string().uuid(),
  mode: z.enum(["default", "percent", "amount"]),
  value: z.string().max(40),
  blockOrders: z.boolean(),
  note: z.string().max(600),
});

/** Limit jednog kupca: vlasnik svima, komercijalista svojim kupcima (proverava servis). */
export async function setLimitAction(input: z.infer<typeof LimitInput>): Promise<LimitActionResult> {
  const user = await requireCapability("view:limiti", "/portal/limiti");
  const parsed = LimitInput.safeParse(input);
  if (!parsed.success) return { ok: false, text: "Neispravan unos." };
  try {
    await setCreditLimit(user, parsed.data);
    revalidatePath("/portal/limiti");
    return { ok: true, text: "Sačuvano." };
  } catch (error) {
    if (error instanceof CreditError) return { ok: false, text: error.message };
    throw error;
  }
}

/** Podrazumevani procenat za sve kupce bez sopstvenog limita (samo vlasnik). */
export async function setDefaultPercentAction(_prev: LimitActionResult, form: FormData): Promise<LimitActionResult> {
  const user = await requireCapability("limits:approve", "/portal/limiti");
  try {
    await setDefaultCreditPercent(user, String(form.get("procenat") ?? ""));
    revalidatePath("/portal/limiti");
    return { ok: true, text: "Podrazumevani procenat je sačuvan." };
  } catch (error) {
    if (error instanceof CreditError) return { ok: false, text: error.message };
    throw error;
  }
}
