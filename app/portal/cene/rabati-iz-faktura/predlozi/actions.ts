"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { approveRebateGroup } from "@/lib/pricing/rebate-coverage-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

const PATH = "/portal/cene/rabati-iz-faktura/predlozi";

/**
 * Poruka servisa (običan `Error` sa tekstom za korisnika) se prikazuje; greška
 * baze ili biblioteke ne — nosi SQL i interne detalje (revizija 2026-10-11, B7).
 */
function userMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.constructor === Error && !("code" in error) && error.cause === undefined) return error.message;
  console.error("rabati-iz-faktura/predlozi", error);
  return fallback;
}

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
    return { ok: false, message: userMessage(error, "Grupa nije sačuvana. Pokušajte ponovo; ako se ponovi, javite se.") };
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
      if (!r.ok) {
        // Već upisane grupe ostaju (serija se opoziva kao celina) — prikaz mora da ih pokaže.
        if (count) revalidatePath(PATH);
        return { ok: false, message: `${count ? `Upisano ${count} pravila; zatim: ` : ""}grupa „${s.groupKey}“: ${r.message}` };
      }
      count += r.count;
      approved = r.approved;
    }
  } catch (error) {
    if (count) revalidatePath(PATH);
    const why = userMessage(error, "Grupe nisu sačuvane.");
    return { ok: false, message: count ? `Upisano ${count} pravila (serija ${batchId}); zatim: ${why}` : why };
  }
  revalidatePath(PATH);
  return { ok: true, message: approved ? `Odobreno ${count} pravila u ${selections.length} grupa (serija ${batchId}).` : `Poslato na odobrenje: ${count} predloga u ${selections.length} grupa (jedan paket).` };
}
