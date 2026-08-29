import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { articles, priceRules } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { reconciliationEvidence } from "@/lib/ledger/effective-sales";
import { reconcileRule, SUPPORTED_CURRENCY } from "@/lib/pricing/reconciliation.mjs";
import {
  ACTOR_SYSTEM,
  rejectTransition,
  WorkflowError,
} from "@/lib/pricing/workflow.mjs";

/**
 * Usaglašavanje pravila cene sa stvarno fakturisanim uslovom.
 *
 * Ovo je JEDINI put do `confirmed`. Nijedan ekran, server akcija ni ljudska
 * uloga ne vodi u to stanje — `SYSTEM_ONLY_STATUSES` ga odbija u toku, a
 * `price_rules_confirmed_needs_invoice_ck` i strani ključ na `invoices` ga
 * odbijaju u bazi. Tri nezavisne prepreke za istu tvrdnju, jer je ta tvrdnja
 * ono što kupac čita kao obećanje cene.
 *
 * Servis ne odlučuje ništa o poslu: on samo traži dokaz i zapisuje nalaz.
 */

export type ReconciliationActor = { id: string; name: string; role: string };

export type ReconciliationOutcome =
  | "confirmed"
  | "failed"
  | "no_evidence_yet"
  | "not_applicable"
  | "not_eligible";

export type ReconciliationResult = {
  ruleId: string;
  outcome: ReconciliationOutcome;
  detail: string;
};

/*
 * Sposobnost koju nijedan paket dozvola ne dodeljuje.
 *
 * Servis je nosi zato što JESTE sistemski akter. Da je uzeta iz paketa
 * korisnika, svaki pozivalac bi je nasledio i `confirmed` bi ponovo postao
 * ljudska radnja.
 */
const SYSTEM_CAPABILITIES = ["prices:reconcile_system"] as const;

/** Sistemski akter u tragu revizije. Nije korisnik i ne sme se predstaviti kao korisnik. */
const SYSTEM_ACTOR = {
  id: null,
  name: "Usaglašavanje sa fakturom",
  role: "sistem",
} as const;

/**
 * Usaglašava jedno pravilo.
 *
 * Kandidat je isključivo pravilo u `office_recorded` — dakle ono za koje je
 * kancelarija izjavila da je uneto u BizniSoft. Pravilo koje niko nije uneo
 * nema šta da se usaglašava, i njegov prolaz kroz servis bi značio da se
 * `confirmed` može dobiti mimo ljudskog koraka.
 */
export async function reconcilePriceRule(
  ruleId: string,
  triggeredBy: ReconciliationActor,
): Promise<ReconciliationResult> {
  const db = getDb();

  const found = await db
    .select({
      id: priceRules.id,
      status: priceRules.status,
      customerScope: priceRules.customerScope,
      customerId: priceRules.customerId,
      productScope: priceRules.productScope,
      articleId: priceRules.articleId,
      valueKind: priceRules.valueKind,
      currency: priceRules.currency,
      discountPercent: priceRules.discountPercent,
      netPrice: priceRules.netPrice,
      effectiveFrom: priceRules.effectiveFrom,
      effectiveTo: priceRules.effectiveTo,
    })
    .from(priceRules)
    .where(eq(priceRules.id, ruleId))
    .limit(1);

  const rule = found[0];
  if (!rule) throw new WorkflowError("Pravilo cene ne postoji.", "not_found");

  if (rule.status !== "office_recorded") {
    return {
      ruleId,
      outcome: "not_eligible",
      detail:
        "Usaglašava se samo pravilo koje je kancelarija evidentirala kao uneto u BizniSoft.",
    };
  }

  const shaped = {
    currency: rule.currency,
    customerScope: rule.customerScope,
    productScope: rule.productScope,
    valueKind: rule.valueKind,
    discountPercent: rule.discountPercent === null ? null : Number(rule.discountPercent),
    netPrice: rule.netPrice === null ? null : Number(rule.netPrice),
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  };

  /*
   * Dokaz se traži samo za par (kupac, artikal).
   *
   * Za širi opseg se ledger i ne čita: nalaz je unapred `not_applicable`, pa
   * nema ni izgovora da se „našlo nešto blizu".
   */
  let evidence: Awaited<ReturnType<typeof reconciliationEvidence>> = [];
  if (
    rule.currency === SUPPORTED_CURRENCY &&
    rule.customerScope === "customer" &&
    rule.productScope === "article" &&
    rule.customerId
  ) {
    const article = rule.articleId
      ? await db
          .select({ code: articles.code })
          .from(articles)
          .where(eq(articles.id, rule.articleId))
          .limit(1)
      : [];
    const code = article[0]?.code;
    if (code) {
      /*
       * Opseg je izričito jedan kupac — onaj iz pravila.
       *
       * Ne prosleđuje se `null` („bez ograničenja"), iako je akter sistemski:
       * time bi jedan pogrešan `customer_id` u upitu mogao potvrditi pravilo
       * dokazom sa tuđe fakture.
       */
      evidence = await reconciliationEvidence(
        { customerIds: [rule.customerId] },
        { customerId: rule.customerId, articleCode: code },
      );
    }
  }

  const verdict = reconcileRule({ rule: shaped, lines: evidence });

  if (verdict.outcome === "no_evidence_yet") {
    // Pravilo ostaje gde jeste. Nema nalaza, pa nema ni upisa.
    return { ruleId, outcome: "no_evidence_yet", detail: verdict.detail };
  }

  if (verdict.outcome === "not_applicable") {
    /*
     * Širi opseg se NE proglašava neuspehom.
     *
     * `reconciliation_failed` tvrdi da uslov nije primenjen; ovde se samo ne
     * može dokazati. Pravilo ostaje u `office_recorded` i vidi se u redu za
     * ručni pregled.
     */
    return { ruleId, outcome: "not_applicable", detail: verdict.detail };
  }

  const target = verdict.outcome === "confirmed" ? "confirmed" : "reconciliation_failed";

  const refusal = rejectTransition({
    from: rule.status,
    to: target,
    capabilities: SYSTEM_CAPABILITIES,
    reason: verdict.detail,
    actorKind: ACTOR_SYSTEM,
  });
  if (refusal) throw new WorkflowError(refusal, "transition_refused");

  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    /*
     * Uslov `status = 'office_recorded'` stoji i u `WHERE`.
     *
     * Ako je u međuvremenu neko opozvao pravilo, upis ne pogađa nijedan red
     * umesto da vrati opozvano pravilo u potvrđeno.
     */
    const updated = await tx
      .update(priceRules)
      .set(
        target === "confirmed"
          ? {
              status: "confirmed",
              reconciledInvoiceId: verdict.evidence!.invoiceId,
              reconciledInvoiceLineId: verdict.evidence!.invoiceLineId,
              reconciledAt: new Date(),
              reconciliationNote: verdict.detail,
              // `confirmed_by` ostaje prazan: potvrdu nije dao čovek.
              confirmedAt: new Date(),
              confirmationNote: verdict.detail,
              updatedAt: new Date(),
            }
          : {
              status: "reconciliation_failed",
              reconciledAt: new Date(),
              reconciliationNote: verdict.detail,
              updatedAt: new Date(),
            },
      )
      .where(and(eq(priceRules.id, ruleId), eq(priceRules.status, "office_recorded")))
      .returning({ id: priceRules.id });

    if (updated.length === 0) {
      throw new WorkflowError(
        "Pravilo je u međuvremenu promenilo stanje; nalaz nije upisan.",
        "stale",
      );
    }

    await recordAudit(
      {
        // Trag nosi i sistemskog aktera i čoveka koji je pokrenuo prolaz.
        actor: SYSTEM_ACTOR,
        action:
          target === "confirmed"
            ? AUDIT_ACTIONS.priceRuleReconciled
            : AUDIT_ACTIONS.priceRuleReconciliationFailed,
        entityType: "Pravilo cene",
        entityId: ruleId,
        entityLabel: `pr:${ruleId.slice(0, 8)}`,
        before: { status: rule.status },
        after: {
          status: target,
          invoiceId: verdict.evidence?.invoiceId ?? null,
          invoiceLineId: verdict.evidence?.invoiceLineId ?? null,
          pokrenuo: triggeredBy.id,
        },
        reason: verdict.detail,
        correlationId,
      },
      tx,
    );
  });

  return { ruleId, outcome: verdict.outcome as ReconciliationOutcome, detail: verdict.detail };
}

/**
 * Prolazi kroz sva pravila koja čekaju usaglašavanje.
 *
 * Jedno pravilo po transakciji: jedan sporan slučaj ne sme da poništi nalaze
 * za sve ostale.
 */
export async function reconcileOfficeRecorded(
  triggeredBy: ReconciliationActor,
): Promise<{ results: ReconciliationResult[] }> {
  const db = getDb();
  const pending = await db
    .select({ id: priceRules.id })
    .from(priceRules)
    .where(eq(priceRules.status, "office_recorded"));

  const results: ReconciliationResult[] = [];
  for (const row of pending) {
    try {
      results.push(await reconcilePriceRule(row.id, triggeredBy));
    } catch (error) {
      if (!(error instanceof WorkflowError)) throw error;
      results.push({ ruleId: row.id, outcome: "not_eligible", detail: error.message });
    }
  }
  return { results };
}
