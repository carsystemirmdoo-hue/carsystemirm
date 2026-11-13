import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { optionLabel } from "@/lib/pricing/paymentOptions.mjs";
import { PricingScopeError } from "@/lib/pricing/pricing-scope";
import { RebateChangeError } from "@/lib/pricing/rebate-change-service";
import { loadRebateTable } from "@/lib/pricing/rebate-table-service";
import { RebateTable } from "./RebateTable";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { readPortalPeriod } from "@/lib/portal/period";
import { isAllTime, periodLabel } from "@/lib/portal/periodMemory.mjs";

export const dynamic = "force-dynamic";
// Čuvanje većeg broja artikala (svaki je jedno pravilo sa tragom) traje.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tabela rabata kupca (2026-11-09): svi artikli u ponudi — koje uzima i koje
 * ne — i izmena po brendu, grupi, artiklu, izboru ili neto ceni.
 */
export default async function RebateTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const period = await readPortalPeriod(await searchParams);
  if (!UUID.test(id)) notFound();
  const user = await requireCapability("view:rabati", `/portal/cene/rabati-iz-faktura/kupci/${id}/tabela`);
  let data: Awaited<ReturnType<typeof loadRebateTable>>;
  try {
    data = await loadRebateTable(user, id, new Date(), period);
  } catch (error) {
    if (error instanceof PricingScopeError) forbidden();
    if (error instanceof RebateChangeError) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        eyebrow="Rabati kupca"
        title={data.customer.name}
        description="Svi artikli u ponudi: koje kupac uzima i koje ne, važeći rabat i neto cena. Rabat menjate za ceo brend, grupu, jedan artikal ili izabrane artikle; neto cenu po artiklu."
        meta={
          data.paymentOptions.length ? (
            <span>
              Prikazan je osnovni uslov. Odobrene opcije plaćanja ({data.paymentOptions.map((c) => optionLabel(c)).join(", ")}) menjate na stranici kupca.
            </span>
          ) : undefined
        }
        actions={
          <>
            {seesAllCustomers(user) ? (
              <Link className="rr-link" href={`/portal/cene/rabati-iz-faktura/kupci/${id}`}>← Rabati iz faktura</Link>
            ) : (
              <Link className="rr-link" href="/portal/cene/rabati-iz-faktura/kupci">← Rabati kupaca</Link>
            )}
            <Link className="rr-link" href={`/portal/kupci/${id}/preporuke`}>Preporuke i ponuda</Link>
            <Link className="rr-link" href={`/portal/kupci/${id}`}>Kartica kupca</Link>
          </>
        }
      />
      <section className="portal-panel">
        <form method="get" className="portal-inline-form">
          <DateRangeField nameOd="from" nameDo="to" defaultOd={period.from} defaultDo={period.to} zapamti />
          <button type="submit" className="portal-button" data-variant="primary">
            Prikažite
          </button>
        </form>
        <p className="portal-footnote">
          {isAllTime(period)
            ? "„Uzima“ znači da je kupac artikal kupio u poslednjih 365 dana. Izaberite period da biste videli šta je uzimao u tom periodu."
            : `„Uzima“ znači da je kupac artikal kupio u periodu ${periodLabel(period).replace(/\.$/, "")}; broj uz „Uzima“ je broj dana kupovine u periodu. Rabati i cene se ne menjaju izborom perioda.`}
        </p>
      </section>
      <RebateTable key={`${period.from ?? ""}|${period.to ?? ""}`} buysLabel={isAllTime(period) ? "Uzima (12 meseci)" : "Uzima (u periodu)"} customerId={id} rows={data.rows} today={data.today} canPropose={data.canPropose} canApprove={data.canApprove} />
    </>
  );
}
