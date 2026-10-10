"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { approveRebateGroup } from "@/lib/pricing/rebate-coverage-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

const PATH = "/portal/cene/rabati-iz-faktura/predlozi";

/**
 * Grupa kupac × porodica jednim potezom. Vlasnik odobrava (pravila sa oznakom
 * serije, opoziva se kao serija); predlagač šalje predloge na odobrenje. Server
 * ponovo računa dokaz i prihvata samo artikle koji su i dalje u grupi.
 */
export async function approveRebateGroupAction(
  customerId: string,
  groupKey: string,
  expected: { articleId: string; percent: number }[],
): Promise<{ ok: boolean; message: string }> {
  const user = await requireCapability("prices:propose", PATH);
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(customerId) || !Array.isArray(expected) || expected.length > 2000 || expected.some((e) => !uuid.test(e.articleId) || typeof e.percent !== "number")) {
    return { ok: false, message: "Neispravan zahtev." };
  }
  try {
    const r = await approveRebateGroup(user, { customerId, groupKey: String(groupKey).slice(0, 120), expected, asOf: belgradeDate(new Date()) });
    revalidatePath(PATH);
    if (!r.ok) return { ok: false, message: r.message };
    return {
      ok: true,
      message: r.approved
        ? `Odobreno ${r.count} pravila (serija ${r.batchId}; opoziv kao serija).`
        : `Poslato na odobrenje: ${r.count} predloga.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Grupa nije sačuvana." };
  }
}

