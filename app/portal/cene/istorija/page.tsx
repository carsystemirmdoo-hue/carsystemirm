import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listPriceRules } from "@/lib/pricing/rule-service";
import { resolvePricingScope } from "@/lib/pricing/pricing-scope";
import { RuleTable } from "../RuleTable";

export const dynamic = "force-dynamic";

export default async function PriceHistoryPage() {
  const user = await requireCapability("view:cene", "/portal/cene/istorija");
  const canDecide = can(user, "prices:approve");
  const scope = await resolvePricingScope(user);
  const rules = await listPriceRules(scope, { limit: 500 });

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Istorija cena"
        description={
          scope.seesAll
            ? "Sva pravila, u svakom stanju, sa podatkom ko je predložio, ko odlučio i da li je unos evidentiran."
            : "Pravila koja utiču na VAŠE dodeljene kupce, plus globalna pravila. Tuđi kupci se ne prikazuju."
        }
        meta={<span>Ukupno pravila: {rules.length}</span>}
      />
      <section className="portal-panel">
        <p>
          Potpuni trag svake promene — sa starom i novom vrednošću — stoji u{" "}
          <strong>Aktivnostima</strong>. Trag je append-only i ne može se
          izmeniti ni obrisati, pa je ovaj pregled njegov sažetak, ne zamena.
        </p>
      </section>
      <RuleTable rows={rules} showActions={canDecide} />
    </>
  );
}
