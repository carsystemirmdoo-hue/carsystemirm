import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import {
  articles,
  customerGroups,
  customers,
  priceRules,
  users,
  type PriceRuleRow,
  type PriceRuleStatus,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { resolveCapabilities } from "@/lib/authz/permissions.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { notify } from "@/lib/notifications/notification-service";
import {
  precedenceLabelFor,
  precedenceLevelFor,
  PricingRuleError,
  rejectRuleShape,
  scopeKeyFor,
} from "@/lib/pricing/precedence.mjs";
import {
  ACTOR_HUMAN,
  actionFor,
  rejectTransition,
  WorkflowError,
} from "@/lib/pricing/workflow.mjs";

export type RuleDraft = {
  customerScope: "customer" | "group" | "all";
  customerId?: string | null;
  customerGroupId?: string | null;
  productScope: "article" | "product_group" | "brand" | "all";
  articleId?: string | null;
  productGroup?: string | null;
  brand?: string | null;
  valueKind: "discount_percent" | "net_price";
  discountPercent?: number | null;
  netPrice?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reason: string;
};

/**
 * Predlaže pravilo cene.
 *
 * Komercijalista sme da predloži SAMO za dodeljene kupce. Provera ide kroz
 * `canAccessCustomer` — isti put kojim se već štiti ekran kupca — da se dva
 * pojma opsega ne bi razišla. Grupno i globalno pravilo traže `customers:view_all`:
 * predlog koji dodiruje sve kupce ne sme dati onaj ko vidi samo neke.
 */
export async function proposePriceRule(
  draft: RuleDraft,
  actor: PortalUser,
): Promise<{ id: string; status: PriceRuleStatus }> {
  const capabilities = resolveCapabilities(actor.role, actor.permissions);
  if (!capabilities.has("prices:propose")) {
    throw new WorkflowError(
      'Za predlaganje cena je potrebna dozvola „prices:propose".',
      "forbidden",
    );
  }

  const shapeProblem = rejectRuleShape(draft);
  if (shapeProblem) throw new PricingRuleError(shapeProblem, "bad_shape");

  const reason = draft.reason.trim();
  if (reason.length < 3) {
    throw new PricingRuleError(
      "Predlog traži obrazložen razlog (najmanje 3 znaka).",
      "missing_reason",
    );
  }

  await assertScopeAllowed(draft, actor, capabilities);

  const level = precedenceLevelFor(draft);
  const scopeKey = scopeKeyFor(draft);
  const correlationId = randomUUID();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(priceRules)
      .values({
        customerScope: draft.customerScope,
        customerId: draft.customerId ?? null,
        customerGroupId: draft.customerGroupId ?? null,
        productScope: draft.productScope,
        articleId: draft.articleId ?? null,
        productGroup: draft.productGroup ?? null,
        brand: draft.brand ?? null,
        precedenceLevel: level,
        scopeKey,
        valueKind: draft.valueKind,
        discountPercent:
          draft.discountPercent === null || draft.discountPercent === undefined
            ? null
            : String(draft.discountPercent),
        netPrice:
          draft.netPrice === null || draft.netPrice === undefined
            ? null
            : String(draft.netPrice),
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo ?? null,
        // Predlog odmah ide na odobrenje; `draft` ostaje za buduće čuvanje
        // nedovršenog unosa, koje ovaj tok ne koristi.
        status: "pending_approval",
        reason,
        proposedBy: actor.id,
        proposedAt: sql`now()`,
      })
      .returning({ id: priceRules.id });

    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceRuleProposed,
        entityType: "Pravilo cene",
        entityId: created.id,
        entityLabel: `${precedenceLabelFor(level)} · ${scopeKey}`,
        before: null,
        after: {
          status: "pending_approval",
          klasa: level,
          opseg: scopeKey,
          vrsta: draft.valueKind,
          vrednost: draft.discountPercent ?? draft.netPrice,
          vaziOd: draft.effectiveFrom,
          vaziDo: draft.effectiveTo ?? null,
        },
        reason,
        correlationId,
      },
      tx,
    );

    await notify(
      {
        kind: "price_rule_proposed",
        severity: "info",
        // Vidi ga onaj ko odlučuje, ne onaj ko predlaže.
        requiredCapability: "prices:approve",
        title: "Nov predlog promene cene",
        body: `${actor.name} predlaže ${precedenceLabelFor(level)} (${scopeKey}). Razlog: ${reason}`,
        entityType: "Pravilo cene",
        entityId: created.id,
        actionHref: "/portal/cene/odobravanje",
        context: { klasa: level, opseg: scopeKey },
        correlationId,
      },
      tx,
    );

    return { id: created.id, status: "pending_approval" as const };
  });
}

/**
 * Prevodi pravilo u novo stanje.
 *
 * Jedan ulaz za sve prelaze: odobrenje, odbijanje, evidentiranje primene,
 * opoziv i istek. Da svaki ima svoju funkciju, svaka bi ponovila proveru
 * prelaza — i jedna bi je ponovila malo drugačije.
 */
export async function transitionPriceRule(
  input: {
    ruleId: string;
    to: PriceRuleStatus;
    reason?: string | null;
    /** Napomena kancelarije o tome ŠTA je uneto u BizniSoft; obavezna za `office_recorded`. */
    officeRecordNote?: string | null;
  },
  actor: PortalUser,
): Promise<void> {
  const db = getDb();
  const [rule] = await db
    .select()
    .from(priceRules)
    .where(eq(priceRules.id, input.ruleId))
    .limit(1);

  if (!rule) throw new WorkflowError("Pravilo cene ne postoji.", "not_found");

  const capabilities = resolveCapabilities(actor.role, actor.permissions);
  /*
   * Napomena kancelarije je „razlog" za `office_recorded`.
   *
   * Spajanje ta dva polja ovde znači da se pravilo „ova radnja traži
   * obrazloženje" proverava na JEDNOM mestu, umesto da svaki prelaz nosi svoju
   * varijantu iste provere.
   */
  const transitionReason =
    input.to === "office_recorded"
      ? (input.officeRecordNote ?? input.reason)
      : input.reason;

  const refusal = rejectTransition({
    from: rule.status,
    to: input.to,
    capabilities,
    reason: transitionReason,
    actorIsProposer: rule.proposedBy === actor.id,
    // Nijedan ljudski put ne prosleđuje `system` — vidi `SYSTEM_ONLY_STATUSES`.
    actorKind: ACTOR_HUMAN,
  });
  if (refusal) throw new WorkflowError(refusal, "bad_transition");

  const reason = transitionReason?.trim() || null;
  const correlationId = randomUUID();
  const action = actionFor(rule.status, input.to);

  await db.transaction(async (tx) => {
    await tx
      .update(priceRules)
      .set({
        status: input.to,
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
        /*
         * `confirmed*` polja se NE diraju ovde ni u jednom slučaju.
         *
         * Njih popunjava budući reconciliation servis, zajedno sa
         * `reconciled_invoice_id`. Ljudski put upisuje isključivo evidenciju
         * kancelarije.
         */
        officeRecordedBy:
          input.to === "office_recorded" ? actor.id : rule.officeRecordedBy,
        officeRecordedAt:
          input.to === "office_recorded" ? sql`now()` : rule.officeRecordedAt,
        officeRecordNote:
          input.to === "office_recorded" ? reason : rule.officeRecordNote,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(priceRules.id, input.ruleId),
          // Optimistička provera: ako je neko u međuvremenu promenio stanje,
          // ovaj `UPDATE` ne pogađa nijedan red umesto da pregazi tuđu odluku.
          eq(priceRules.status, rule.status),
        ),
      );

    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.priceRuleTransitioned,
        entityType: "Pravilo cene",
        entityId: input.ruleId,
        entityLabel: `${precedenceLabelFor(rule.precedenceLevel)} · ${rule.scopeKey}`,
        before: { status: rule.status },
        after: { status: input.to, radnja: action },
        reason: reason ?? `Prelaz ${rule.status} → ${input.to}`,
        correlationId,
      },
      tx,
    );

    const notification = notificationForTransition(input.to, rule, actor, reason);
    if (notification) {
      await notify({ ...notification, correlationId }, tx);
    }
  });
}

/** Obaveštenje koje prati dati prelaz, ili `null` kada ga ne treba slati. */
function notificationForTransition(
  to: PriceRuleStatus,
  rule: PriceRuleRow,
  actor: PortalUser,
  reason: string | null,
) {
  const label = `${precedenceLabelFor(rule.precedenceLevel)} · ${rule.scopeKey}`;

  switch (to) {
    case "approved_pending_biznisoft":
      return {
        kind: "price_rule_approved" as const,
        severity: "info" as const,
        /*
         * Ide KANCELARIJI, ne gazdi: gazda je upravo odobrio, a sledeći korak
         * je ručni upis u BizniSoft. Obaveštenje koje stiže onome ko je radnju
         * i izvršio je šum, i uči ljude da preskaču listu.
         */
        requiredCapability: "prices:apply",
        title: "Odobrena promena cene čeka upis u BizniSoft",
        body: `${actor.name} je odobrio ${label}. Uslov još NIJE potvrđen kao upisan u BizniSoft.`,
        entityType: "Pravilo cene",
        entityId: rule.id,
        actionHref: "/portal/cene/odobravanje",
        context: { klasa: rule.precedenceLevel, opseg: rule.scopeKey },
      };
    case "rejected":
      return {
        kind: "price_rule_rejected" as const,
        severity: "info" as const,
        requiredCapability: "prices:propose",
        title: "Predlog promene cene je odbijen",
        body: `${label} — odbio ${actor.name}. Razlog: ${reason ?? "nije naveden"}`,
        entityType: "Pravilo cene",
        entityId: rule.id,
        actionHref: "/portal/cene/istorija",
        context: { klasa: rule.precedenceLevel, opseg: rule.scopeKey },
      };
    case "office_recorded":
      return {
        kind: "price_rule_approved" as const,
        severity: "info" as const,
        /*
         * Gazdi, jer je on odobrio i mora znati da je kancelarija unela.
         * Poruka izričito kaže da fakturska potvrda i dalje ne postoji.
         */
        requiredCapability: "prices:approve" as const,
        title: "Kancelarija evidentirala unos u BizniSoft",
        body: `${label} — evidentirao ${actor.name}. NIJE potvrđeno fakturom; potvrdu daje tek usaglašavanje.`,
        entityType: "Pravilo cene",
        entityId: rule.id,
        actionHref: "/portal/cene/istorija",
        context: { klasa: rule.precedenceLevel, opseg: rule.scopeKey },
      };
    case "reconciliation_failed":
      return {
        kind: "price_rule_reconciliation_failed" as const,
        severity: "critical" as const,
        /*
         * Ovo ide GAZDI. Tihi otkaz — odobreno u portalu, nikad upisano u
         * BizniSoft — je jedino stanje u kome sistem i knjigovodstvo tvrde
         * različite stvari, a niko to ne vidi dok kupac ne dobije fakturu.
         */
        requiredCapability: "prices:approve",
        title: "Odobrena cena nije potvrđena u BizniSoftu",
        body: `${label} — ${reason ?? "usaglašavanje nije uspelo"}.`,
        entityType: "Pravilo cene",
        entityId: rule.id,
        actionHref: "/portal/cene/istorija",
        context: { klasa: rule.precedenceLevel, opseg: rule.scopeKey },
      };
    case "revoked":
      return {
        kind: "price_rule_revoked" as const,
        severity: "warning" as const,
        requiredCapability: "prices:approve",
        title: "Pravilo cene je opozvano",
        body: `${label} — opozvao ${actor.name}. Razlog: ${reason ?? "nije naveden"}`,
        entityType: "Pravilo cene",
        entityId: rule.id,
        actionHref: "/portal/cene/istorija",
        context: { klasa: rule.precedenceLevel, opseg: rule.scopeKey },
      };
    // `confirmed` i `expired` ne šalju obaveštenje: prvo je očekivan ishod
    // radnje koju je čovek upravo izvršio, drugo je protek vremena.
    default:
      return null;
  }
}

/**
 * Sme li akter uopšte da predloži pravilo ovog opsega.
 *
 * Grupno i globalno pravilo dodiruju kupce koje komercijalista možda ne vidi.
 * Predlog koji menja uslove nekome van sopstvenog opsega nije predlog nego
 * zaobilaženje opsega.
 */
async function assertScopeAllowed(
  draft: RuleDraft,
  actor: PortalUser,
  capabilities: Set<string>,
) {
  if (draft.customerScope === "customer") {
    const assigned = await loadAssignedCustomerIds(actor.id);
    if (!canAccessCustomer(actor, assigned, draft.customerId!)) {
      throw new WorkflowError(
        "Kupac nije u vašem opsegu — predlog nije moguć.",
        "out_of_scope",
      );
    }
    return;
  }

  if (!capabilities.has("customers:view_all")) {
    throw new WorkflowError(
      "Pravilo za grupu kupaca ili za sve kupce sme da predloži samo onaj ko vidi sve kupce.",
      "out_of_scope",
    );
  }
}

export type PriceRuleView = PriceRuleRow & {
  customerName: string | null;
  customerGroupName: string | null;
  articleCode: string | null;
  articleName: string | null;
  precedenceLabel: string | null;
  proposedByName: string | null;
  decidedByName: string | null;
  officeRecordedByName: string | null;
};

/** Pravila sa čitljivim nazivima opsega, za ekrane. */
export async function listPriceRules(filter?: {
  statuses?: PriceRuleStatus[];
  customerId?: string;
  limit?: number;
}): Promise<PriceRuleView[]> {
  const db = getDb();
  const conditions = [];
  if (filter?.statuses?.length) {
    conditions.push(inArray(priceRules.status, filter.statuses));
  }
  if (filter?.customerId) {
    conditions.push(eq(priceRules.customerId, filter.customerId));
  }

  /*
   * Imena ljudi se spajaju u upitu, ne dovlace posebno po redu.
   *
   * Ekran odobravanja mora u istom pogledu pokazati ko je predlozio, ko odlucio
   * i ko evidentirao primenu — bez toga „ko stoji iza ove cene" postaje pitanje
   * na koje se odgovara pretragom kroz Aktivnosti.
   */
  const proposer = alias(users, "proposer");
  const decider = alias(users, "decider");
  const recorder = alias(users, "recorder");

  const rows = await db
    .select({
      rule: priceRules,
      customerName: customers.name,
      customerGroupName: customerGroups.name,
      articleCode: articles.code,
      articleName: articles.name,
      proposedByName: proposer.name,
      decidedByName: decider.name,
      officeRecordedByName: recorder.name,
    })
    .from(priceRules)
    .leftJoin(customers, eq(customers.id, priceRules.customerId))
    .leftJoin(customerGroups, eq(customerGroups.id, priceRules.customerGroupId))
    .leftJoin(articles, eq(articles.id, priceRules.articleId))
    .leftJoin(proposer, eq(proposer.id, priceRules.proposedBy))
    .leftJoin(decider, eq(decider.id, priceRules.decidedBy))
    .leftJoin(recorder, eq(recorder.id, priceRules.officeRecordedBy))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(priceRules.createdAt))
    .limit(filter?.limit ?? 200);

  return rows.map((row) => ({
    ...row.rule,
    customerName: row.customerName,
    customerGroupName: row.customerGroupName,
    articleCode: row.articleCode,
    articleName: row.articleName,
    precedenceLabel: precedenceLabelFor(row.rule.precedenceLevel),
    proposedByName: row.proposedByName,
    decidedByName: row.decidedByName,
    officeRecordedByName: row.officeRecordedByName,
  }));
}

export { PricingRuleError, WorkflowError };
