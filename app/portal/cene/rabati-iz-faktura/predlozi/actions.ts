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


/**
 * Više grupa istog kupca odjednom (jedan paket). Svaka grupa se proverava
 * posebno; prva koja se promenila zaustavlja slanje ostalih.
 */
export async function approveRebateGroupsAction(
  customerId: string,
  selections: { groupKey: string; expected: { articleId: string; percent: number }[] }[],
): Promise<{ ok: boolean; message: string }> {
  const user = await requireCapability("prices:propose", PATH);
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(customerId) || !Array.isArray(selections) || !selections.length || selections.length > 200) return { ok: false, message: "Izaberite bar jednu grupu." };
  const asOf = belgradeDate(new Date());
  const batchId = `rabati-v2-${asOf}-${crypto.randomUUID().slice(0, 8)}`;
  let count = 0;
  let approved = false;
  try {
    for (const s of selections) {
      if (!Array.isArray(s.expected) || s.expected.some((e) => !uuid.test(e.articleId) || typeof e.percent !== "number")) return { ok: false, message: "Neispravan zahtev." };
      const r = await approveRebateGroup(user, { customerId, groupKey: String(s.groupKey).slice(0, 120), expected: s.expected, asOf, batchId });
      if (!r.ok) return { ok: false, message: `${count ? `Upisano ${count} pravila; zatim: ` : ""}grupa „${s.groupKey}“: ${r.message}` };
      count += r.count;
      approved = r.approved;
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Grupe nisu sačuvane." };
  }
  revalidatePath(PATH);
  return { ok: true, message: approved ? `Odobreno ${count} pravila u ${selections.length} grupa (serija ${batchId}).` : `Poslato na odobrenje: ${count} predloga u ${selections.length} grupa (jedan paket).` };
}
