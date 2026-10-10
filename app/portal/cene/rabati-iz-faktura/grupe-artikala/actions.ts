"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { confirmBrand } from "@/lib/pricing/article-group-service";

export async function confirmBrandAction(brand: string, reason: string) {
  const user = await requireCapability("prices:approve", "/portal/cene/rabati-iz-faktura/grupe-artikala");
  try {
    const r = await confirmBrand(user, { brand: String(brand).slice(0, 40), reason: String(reason ?? "") });
    revalidatePath("/portal/cene/rabati-iz-faktura/grupe-artikala");
    return { ok: true, message: `Grupa „${brand}“ potvrđena: ${r.assigned} artikala.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Nije sačuvano." };
  }
}
