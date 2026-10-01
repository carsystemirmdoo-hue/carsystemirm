import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { articles, customerGroups } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listPriceRules } from "@/lib/pricing/rule-service";
import {
  listScopedCustomers,
  resolvePricingScope,
} from "@/lib/pricing/pricing-scope";
import { ReconciliationPanel } from "@/features/portal/ReconciliationPanel";
import { RuleForm } from "../RuleForm";
import { RuleTable } from "../RuleTable";

export const dynamic = "force-dynamic";

export default async function PriceRulesPage() {
  const user = await requireCapability("view:cene", "/portal/cene/pravila");
  const canPropose = can(user, "prices:propose");

  const db = getDb();

  /*
   * Isti opseg za obrazac i za spisak.
   *
   * Ranije je obrazac bio skopiran, a spisak ispod nije — pa je write path bio
   * zaštićen a read path nije. Postflight audit, F-2.
   */
  const scope = await resolvePricingScope(user);

  const [scopedCustomers, groups, articleRows, rules] = await Promise.all([
    listScopedCustomers(user),
    db
      .select({ id: customerGroups.id, name: customerGroups.name })
      .from(customerGroups)
      .orderBy(asc(customerGroups.name)),
    db
      .select({
        id: articles.id,
        code: articles.code,
        name: articles.name,
        productGroup: articles.productGroup,
        brand: articles.brand,
      })
      .from(articles)
      .orderBy(asc(articles.code))
      .limit(1000),
    listPriceRules(scope, { limit: 200 }),
  ]);

  const productGroups = [
    ...new Set(articleRows.map((row) => row.productGroup).filter(Boolean)),
  ] as string[];
  const brands = [
    ...new Set(articleRows.map((row) => row.brand).filter(Boolean)),
  ] as string[];

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Pravila cene"
        description="Komercijalista predlaže, Vlasnik odobrava, kancelarija evidentira upis u BizniSoft. Nijedan korak ne zatvara krug sam."
      />

      {canPropose ? (
        scopedCustomers.length === 0 && articleRows.length === 0 ? (
          <section className="portal-panel">
            <h2>Predlog još nije moguć</h2>
            <p>
              Pravilo se vezuje za kupca i artikal iz uvoza. Dok uvoz nije
              izvršen, obrazac bi nudio prazne spiskove.
            </p>
          </section>
        ) : (
          <RuleForm
            customers={scopedCustomers.map((customer) => ({
              id: customer.id,
              label: `${customer.name} · PIB ${customer.pib}`,
            }))}
            groups={groups.map((group) => ({ id: group.id, label: group.name }))}
            articles={articleRows.map((article) => ({
              id: article.id,
              label: `${article.code} — ${article.name}`,
            }))}
            productGroups={productGroups}
            brands={brands}
          />
        )
      ) : (
        <section className="portal-panel">
          <p>
            Nemate dozvolu za predlaganje cena. Spisak ispod je samo pregled.
          </p>
        </section>
      )}

      {can(user, "prices:apply") ? (
        <ReconciliationPanel
          pending={rules.filter((rule) => rule.status === "office_recorded").length}
        />
      ) : null}

      <RuleTable rows={rules} />
    </>
  );
}
