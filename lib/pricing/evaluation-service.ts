import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  articles,
  customerGroupMembers,
  customers,
  priceRules,
  type PriceRuleRow,
  type PriceRuleStatus,
} from "@/db/schema";
import {
  evaluatePricing,
  netPriceFrom,
  precedenceLabelFor,
  type PricingRuleError,
} from "@/lib/pricing/precedence.mjs";
import {
  isBiznisoftConfirmed,
  isOfficeRecorded,
} from "@/lib/pricing/workflow.mjs";
import {
  assertPricingCustomerAccess,
  type PricingScope,
} from "@/lib/pricing/pricing-scope";
import type { PortalUser } from "@/lib/authz/user-repository";

/**
 * Stanja u kojima pravilo UOPŠTE učestvuje u odlučivanju.
 *
 * `approved_pending_biznisoft` je unutra jer poslovno već važi kao odluka
 * firme, ali svaki prikaz mora reći da BizniSoft potvrda još ne postoji —
 * vidi `PricingPreview.confirmed`.
 *
 * `draft`, `pending_approval` i `rejected` su NAMERNO napolju: predlog koji
 * niko nije odobrio ne sme uticati na prikazanu cenu ni na trenutak.
 */
export const ACTIVE_RULE_STATUSES: PriceRuleStatus[] = [
  "approved_pending_biznisoft",
  "office_recorded",
  "confirmed",
];

export type PricingPreview = {
  customerId: string;
  customerName: string | null;
  articleId: string;
  articleCode: string | null;
  articleName: string | null;
  onDate: string;
  /** Pobedničko pravilo, ili `null` kada ga nema ili je ishod konflikt. */
  winner: PriceRuleRow | null;
  level: number | null;
  levelLabel: string | null;
  /** Sva pravila koja su ušla u razmatranje, poređana po prvenstvu. */
  considered: (PriceRuleRow & { level: number; scopeKey: string })[];
  /** Objašnjenje odluke, na srpskom, spremno za prikaz. */
  reason: string;
  conflict: (PriceRuleRow & { level: number })[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /**
   * Da li je uslov POTVRĐEN FAKTUROM.
   *
   * `false` i za `approved_pending_biznisoft` i za `office_recorded`.
   * Evidencija kancelarije je tvrdnja čoveka, ne dokaz — vidi `officeRecorded`.
   */
  confirmed: boolean;
  /** Da li je kancelarija evidentirala ručni unos u BizniSoft. */
  officeRecorded: boolean;
};

/**
 * Razrešava cenu za par (kupac, artikal) na dati dan.
 *
 * Vraća objašnjenje, ne samo broj. Komercijalista koji ne ume da obrazloži
 * cenu kupcu nema od nje koristi, a kancelarija bez objašnjenja nema šta da
 * uporedi sa BizniSoftom kad se razidju.
 */
export async function previewPricing(input: {
  customerId: string;
  articleId: string;
  onDate?: string;
  /**
   * Korisnik koji traži cenu. OBAVEZAN.
   *
   * `customerId` po pravilu stiže iz `searchParams`, pa mora proći kapiju pre
   * nego što uđe u ijedan upit — postflight audit, F-2. Parametar je obavezan
   * da bi novi pozivalac morao da se izjasni, umesto da nasledi rupu.
   */
  viewer: PortalUser;
}): Promise<PricingPreview> {
  await assertPricingCustomerAccess(input.viewer, input.customerId);

  const onDate = input.onDate ?? new Date().toISOString().slice(0, 10);
  const db = getDb();

  const [customerRow] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);

  const [articleRow] = await db
    .select({
      id: articles.id,
      code: articles.code,
      name: articles.name,
      productGroup: articles.productGroup,
      brand: articles.brand,
    })
    .from(articles)
    .where(eq(articles.id, input.articleId))
    .limit(1);

  const groupRows = await db
    .select({ groupId: customerGroupMembers.groupId })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.customerId, input.customerId));
  const customerGroupIds = groupRows.map((row) => row.groupId);

  /*
   * Predfiltriranje ide u SQL, ne u JavaScript.
   *
   * Povlačenje svih pravila pa filtriranje u memoriji radi isto dok pravila
   * ima stotinu, i prestaje da radi kad ih bude deset hiljada — a do tada bi
   * već bilo napisano na više mesta. Konačnu odluku i dalje donosi ista čista
   * funkcija koju testovi dokazuju.
   */
  const candidates = await db
    .select()
    .from(priceRules)
    .where(
      and(
        inArray(priceRules.status, ACTIVE_RULE_STATUSES),
        sql`${priceRules.effectiveFrom} <= ${onDate}`,
        or(
          isNull(priceRules.effectiveTo),
          sql`${priceRules.effectiveTo} >= ${onDate}`,
        ),
        or(
          eq(priceRules.customerScope, "all"),
          and(
            eq(priceRules.customerScope, "customer"),
            eq(priceRules.customerId, input.customerId),
          ),
          customerGroupIds.length > 0
            ? and(
                eq(priceRules.customerScope, "group"),
                inArray(priceRules.customerGroupId, customerGroupIds),
              )
            : // Bez grupa nijedno grupno pravilo ne sme proći. `sql`false`` je
              // izričito „nijedan red", umesto izostavljanja uslova — koje bi
              // propustilo SVA grupna pravila.
              sql`false`,
        ),
      ),
    );

  const context = {
    customerId: input.customerId,
    customerGroupIds,
    articleId: input.articleId,
    productGroup: articleRow?.productGroup ?? null,
    brand: articleRow?.brand ?? null,
    onDate,
  };

  const decision = evaluatePricing(candidates, context);

  return {
    customerId: input.customerId,
    customerName: customerRow?.name ?? null,
    articleId: input.articleId,
    articleCode: articleRow?.code ?? null,
    articleName: articleRow?.name ?? null,
    onDate,
    winner: decision.winner,
    level: decision.level,
    levelLabel: decision.level ? precedenceLabelFor(decision.level) : null,
    considered: decision.considered,
    reason: decision.reason,
    conflict: decision.conflict,
    effectiveFrom: decision.effectiveFrom,
    effectiveTo: decision.effectiveTo,
    confirmed: isBiznisoftConfirmed(decision.winner?.status ?? ""),
    officeRecorded: isOfficeRecorded(decision.winner?.status ?? ""),
  };
}

/**
 * Neto cena iz odluke, uz izričit osnov.
 *
 * `basePrice` je cenovnička cena ako je poznata. Kada nije, rabatno pravilo NE
 * daje broj — vraća se `null` sa objašnjenjem. Izvedena cena bez izvora je
 * pogodak predstavljen kao činjenica.
 */
export function resolveNetPrice(
  preview: PricingPreview,
  basePrice: number | null,
): { netPrice: number | null; basis: string } {
  return netPriceFrom(
    {
      winner: preview.winner,
      level: preview.level,
      levelLabel: preview.levelLabel,
      considered: preview.considered,
      reason: preview.reason,
      conflict: preview.conflict,
      effectiveFrom: preview.effectiveFrom,
      effectiveTo: preview.effectiveTo,
    },
    basePrice,
  );
}

/**
 * Sva pravila koja se sudaraju: ista klasa, isti opseg, preklopljeno važenje.
 *
 * Ovo je izveštaj za kancelariju i gazdu, nezavisan od bilo kog konkretnog
 * artikla. Konflikt otkriven tek pri pogledu na jedan artikal je konflikt koji
 * je već neko vreme davao pogrešan odgovor.
 */
export async function listRuleConflicts(
  scope: PricingScope,
): Promise<
  { precedenceLevel: number; scopeKey: string; ruleIds: string[]; total: number }[]
> {
  const db = getDb();

  /*
   * Konflikti se takođe skopiraju.
   *
   * Neskopiran izveštaj bi komercijalisti otkrio `scope_key` tuđih pravila —
   * a taj ključ sadrži ID kupca. Postflight audit, F-2.
   */
  const scopeCondition = conflictScopeCondition(scope);
  const baseWhere = scopeCondition
    ? and(inArray(priceRules.status, ACTIVE_RULE_STATUSES), scopeCondition)
    : inArray(priceRules.status, ACTIVE_RULE_STATUSES);

  const rows = await db
    .select({
      precedenceLevel: priceRules.precedenceLevel,
      scopeKey: priceRules.scopeKey,
      ruleIds: sql<string[]>`array_agg(${priceRules.id}::text ORDER BY ${priceRules.effectiveFrom})`,
      total: sql<number>`count(*)::int`,
    })
    .from(priceRules)
    .where(baseWhere)
    .groupBy(priceRules.precedenceLevel, priceRules.scopeKey)
    .having(sql`count(*) > 1`);

  /*
   * Grupisanje po (klasa, opseg) hvata kandidate; preklapanje datuma se
   * proverava ovde, jer dva pravila istog opsega koja se smenjuju kroz vreme
   * NISU konflikt. Prijaviti ih kao konflikt značilo bi da bi kancelarija
   * naučila da preskače ovaj izveštaj.
   */
  const conflicts = [];
  for (const row of rows) {
    const rules = await db
      .select({
        id: priceRules.id,
        effectiveFrom: priceRules.effectiveFrom,
        effectiveTo: priceRules.effectiveTo,
      })
      .from(priceRules)
      .where(
        and(
          eq(priceRules.precedenceLevel, row.precedenceLevel),
          eq(priceRules.scopeKey, row.scopeKey),
          inArray(priceRules.status, ACTIVE_RULE_STATUSES),
        ),
      );

    const overlapping = rules.filter((a) =>
      rules.some(
        (b) =>
          a.id !== b.id &&
          a.effectiveFrom <= (b.effectiveTo ?? "9999-12-31") &&
          b.effectiveFrom <= (a.effectiveTo ?? "9999-12-31"),
      ),
    );

    if (overlapping.length > 1) {
      conflicts.push({
        precedenceLevel: row.precedenceLevel,
        scopeKey: row.scopeKey,
        ruleIds: overlapping.map((rule) => rule.id),
        total: overlapping.length,
      });
    }
  }
  return conflicts;
}

/** Isti opseg kao `priceRuleScopeCondition`, izražen nad `price_rules`. */
function conflictScopeCondition(scope: PricingScope) {
  if (scope.seesAll) return null;
  const customerIds = scope.customerIds ?? [];
  const groupIds = scope.groupIds ?? [];

  const branches = [eq(priceRules.customerScope, "all")];
  if (customerIds.length > 0) {
    branches.push(
      and(
        eq(priceRules.customerScope, "customer"),
        inArray(priceRules.customerId, customerIds),
      )!,
    );
  }
  if (groupIds.length > 0) {
    branches.push(
      and(
        eq(priceRules.customerScope, "group"),
        inArray(priceRules.customerGroupId, groupIds),
      )!,
    );
  }
  return or(...branches);
}

export type { PricingRuleError };
