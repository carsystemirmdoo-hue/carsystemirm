import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { quantity } from "@/lib/ordering/panelFormat.mjs";
import { countPriceRules, listPriceRules } from "@/lib/pricing/rule-service";
import { listScopedCustomers, resolvePricingScope } from "@/lib/pricing/pricing-scope";
import { RuleTable } from "../RuleTable";

export const dynamic = "force-dynamic";

/** Najviše redova na ekranu; ukupan broj se broji u bazi. */
const HISTORY_LIMIT = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PriceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ kupac?: string }>;
}) {
  const user = await requireCapability("view:cene", "/portal/cene/istorija");
  const canDecide = can(user, "prices:approve");
  const scope = await resolvePricingScope(user);
  const params = await searchParams;
  const customers = await listScopedCustomers(user);
  /*
   * Kupac iz adrese se prihvata samo ako je u izborniku (opseg korisnika);
   * inače bi filter po tuđem kupcu bio prazan rezultat koji liči na „nema pravila".
   */
  const customerId =
    params.kupac && UUID.test(params.kupac) && customers.some((c) => c.id === params.kupac) ? params.kupac : undefined;
  const filter = customerId ? { customerId } : undefined;
  const [rules, total] = await Promise.all([
    listPriceRules(scope, { ...filter, limit: HISTORY_LIMIT }),
    countPriceRules(scope, filter),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Istorija pravila"
        description={
          scope.seesAll
            ? "Sva pravila, u svakom stanju, sa podatkom ko je predložio, ko odlučio i da li je unos evidentiran."
            : "Pravila koja utiču na VAŠE dodeljene kupce, plus globalna pravila. Tuđi kupci se ne prikazuju."
        }
        meta={<span>Ukupno pravila: {quantity(total)}</span>}
      />
      <section className="portal-panel">
        <form method="get" className="portal-inline-form">
          <select name="kupac" defaultValue={customerId ?? ""} aria-label="Kupac">
            <option value="">Svi kupci</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="portal-button" data-variant="primary">
            Prikažite
          </button>
        </form>
      </section>
      <RuleTable
        rows={rules}
        showActions={canDecide}
        title={`Pravila (${quantity(total)})`}
        description={
          (rules.length < total
            ? `Prikazano najnovijih ${quantity(rules.length)} od ${quantity(total)} — izaberite kupca za njegova pravila. `
            : "") +
          "Potpuni trag svake promene — sa starom i novom vrednošću — stoji u Aktivnostima. Trag se samo dopunjuje i ne može se izmeniti ni obrisati, pa je ovaj pregled njegov sažetak, ne zamena."
        }
      />
    </>
  );
}
