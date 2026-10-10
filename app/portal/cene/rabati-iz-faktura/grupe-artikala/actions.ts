"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { confirmBrand } from "@/lib/pricing/article-group-service";
import { countOf, ARTIKAL } from "@/lib/ordering/plural.mjs";

export async function confirmBrandAction(brand: string, reason: string) {
  const user = await requireCapability("prices:approve", "/portal/cene/rabati-iz-faktura/grupe-artikala");
  try {
    const r = await confirmBrand(user, { brand: String(brand).slice(0, 40), reason: String(reason ?? "") });
    revalidatePath("/portal/cene/rabati-iz-faktura/grupe-artikala");
    return { ok: true, message: `Grupa „${brand}“ potvrđena: ${countOf(r.assigned, ARTIKAL)}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Nije sačuvano." };
  }
}
