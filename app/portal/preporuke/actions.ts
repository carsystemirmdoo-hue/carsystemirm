"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { resolveClientIp } from "@/lib/auth/rate-limit-policy.mjs";
import { registerAttempt } from "@/lib/auth/rate-limit-service";
import { requireCapability } from "@/lib/authz/session";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { parseAsOfDate } from "@/lib/recommendations/asOfDate.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { isRecommendationsEnabled } from "@/lib/recommendations/gate";
import { RecomputeError, recomputeRecommendations } from "@/lib/recommendations/recompute";

/**
 * Server akcija internog ekrana preporuka.
 *
 * Akcija SAMA proverava sposobnost. Sakriveno dugme nije autorizacija — server
 * akcija se poziva i bez ekrana, pa provera mora biti ovde.
 *
 * Opseg se razrešava iz SESIJE, ne iz forme. Skriveni input ne bira kupca, i
 * nijedno polje ne nosi `customerId`.
 */

export type RecomputeState = { error: string | null; ok: string | null };

const PUTANJA = "/portal/preporuke";

/**
 * `asOfDate` dolazi iz forme, ali se PROVERAVA.
 *
 * Zašto uopšte iz forme: obračun mora da može da se ponovi za tačno određen
 * dan — sutra u kancelariji, posle uvoza istorije, sa danom koji je zapisan u
 * izveštaju. Da ga akcija uzima od `new Date()`, dva pokretanja u razmaku od
 * pola noći dala bi različite rezultate bez ijednog vidljivog razloga.
 */
// Provera: `parseAsOfDate` (prazno, oblik, postojanje u kalendaru, ne posle danas).

export async function recomputeAction(
  _previous: RecomputeState,
  formData: FormData,
): Promise<RecomputeState> {
  const actor = await requireCapability("recommendations:recompute", PUTANJA);

  /*
   * Gate se proverava i OVDE, ne samo u prikazu.
   *
   * Dok su preporuke isključene, akcija ne sme da objavi skup koji niko ne
   * može da vidi — a upravo bi to bio recompute bez ekrana.
   */
  if (!isRecommendationsEnabled()) {
    return { error: "Preporuke su isključene na serveru.", ok: null };
  }

  const parsed = parseAsOfDate(formData.get("asOfDate"), belgradeDate(new Date()));
  if (!parsed.ok) {
    return { error: parsed.error, ok: null };
  }

  /*
   * Rate limit i za portal akciju: recompute nad godišnjim prometom nije
   * jeftin, a dugme se može kliktati u petlji.
   */
  const zaglavlja = await headers();
  const ip = resolveClientIp({
    headers: zaglavlja,
    trustedProxy: true,
    socketAddress: null,
  });
  const limit = await registerAttempt({
    scope: "sync_unknown",
    accountIdentifier: `recompute:${actor.id}`,
    clientIp: ip,
  });
  if (!limit.allowed) {
    return { error: "Previše zahteva. Pokušajte kasnije.", ok: null };
  }

  const scope = await resolveLedgerScope(actor);

  try {
    const rezime = await recomputeRecommendations(
      scope,
      { asOfDate: parsed.asOfDate },
      { id: actor.id, name: actor.name, role: actor.role },
    );
    revalidatePath(PUTANJA);
    return {
      error: null,
      ok:
        `Preračunato na dan ${rezime.asOfDate}. ` +
        `Parova: ${rezime.pairCount}, preporuka sa procenom: ${rezime.resultCount}.`,
    };
  } catch (error) {
    if (error instanceof RecomputeError) return { error: error.message, ok: null };
    /*
     * Sirova greška se NE prikazuje: poruka drajvera ume da nosi deo upita i
     * vrednosti iz reda. Detalj ostaje na prolazu, koji kancelarija može da
     * otvori.
     */
    return {
      error: "Preračunavanje nije uspelo. Detalj je zapisan uz prolaz.",
      ok: null,
    };
  }
}
