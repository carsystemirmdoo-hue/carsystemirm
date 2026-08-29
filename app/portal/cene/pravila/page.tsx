import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { articles, customerGroups, customers } from "@/db/schema";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadAssignedCustomerIds } from "@/lib/authz/user-repository";
import { listPriceRules } from "@/lib/pricing/rule-service";
import { RuleForm } from "../RuleForm";
import { RuleTable } from "../RuleTable";

export const dynamic = "force-dynamic";

export default async function PriceRulesPage() {
  const user = await requireCapability("view:cene", "/portal/cene/pravila");
  const canPropose = can(user, "prices:propose");

  const db = getDb();

  /*
   * Spisak kupaca u obrascu je ograničen na opseg korisnika.
   *
   * Servis to i sam proverava, ali obrazac koji nudi kupca kog korisnik ne sme
   * da dodirne uči ga da pokušava — i pretvara zaštitu u prepreku umesto u
   * granicu koja se ne vidi jer je nigde ne dodiruje.
   */
  const assigned = seesAllCustomers(user)
    ? null
    : await loadAssignedCustomerIds(user.id);

  const [allCustomers, groups, articleRows, rules] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name, pib: customers.pib })
      .from(customers)
      .orderBy(asc(customers.name))
      .limit(1000),
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
    listPriceRules({ limit: 200 }),
  ]);

  const scopedCustomers = assigned
    ? allCustomers.filter((customer) => assigned.includes(customer.id))
    : allCustomers;

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
        description="Komercijalista predlaže, gazda odobrava, kancelarija evidentira upis u BizniSoft. Nijedan korak ne zatvara krug sam."
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

      <RuleTable rows={rules} />
    </>
  );
}
