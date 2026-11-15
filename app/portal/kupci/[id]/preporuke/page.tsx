import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { readPortalPeriod } from "@/lib/portal/period";
import { isAllTime, periodLabel } from "@/lib/portal/periodMemory.mjs";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { CustomerOfferError, loadCustomerOffer } from "@/lib/recommendations/customer-offer-service";
import { CustomerDesk } from "@/components/portal/CustomerDesk";
import { CustomerDeskError, loadCustomerDesk } from "@/lib/sales-tools/customer-desk-service";
import { autoRefreshReceivables } from "@/lib/sales-tools/receivables-service";
import { CustomerOffer } from "./CustomerOffer";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preporuke kupca i ponuda (2026-11-10), po odobrenom nacrtu. */
export default async function CustomerOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireCapability("view:preporuke", `/portal/kupci/${id}/preporuke`);
  const showDebt = can(user, "view:dugovanja");
  // Period (2026-11-15): samo artikli koje je kupac kupovao u periodu; zapamćen kao na ostalim ekranima.
  const period = await readPortalPeriod(await searchParams);
  const refreshProblem = showDebt ? await autoRefreshReceivables(user.id) : null;
  let data: Awaited<ReturnType<typeof loadCustomerOffer>>;
  let desk: Awaited<ReturnType<typeof loadCustomerDesk>>;
  try {
    [data, desk] = await Promise.all([loadCustomerOffer(user, id, new Date(), period), loadCustomerDesk(user, id)]);
  } catch (error) {
    if (error instanceof CustomerOfferError || error instanceof CustomerDeskError) {
      if (error.message.includes("opsegu")) forbidden();
      notFound();
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        eyebrow="Preporuke kupca"
        title={data.customer.name}
        description="Pozovite kupca, označite artikle i napravite ponudu u Excelu ili pošaljite zahtev za njega. Posle razgovora kliknite „Zabeleži razgovor“."
        meta={data.asOfDate ? <span>Obračun na dan {data.asOfDate.split("-").reverse().join(".")}.</span> : <span>Preporuke još nisu izračunate.</span>}
        actions={
          <>
            <Link className="rr-link" href="/portal/preporuke">← Preporuke</Link>
            {can(user, "view:rabati") ? <Link className="rr-link" href={`/portal/cene/rabati-iz-faktura/kupci/${id}/tabela`}>Tabela rabata</Link> : null}
            <Link className="rr-link" href={`/portal/kupci/${id}`}>Kartica kupca</Link>
          </>
        }
      />
      {refreshProblem ? <p className="portal-footnote" role="status">Dugovanja: {refreshProblem}</p> : null}
      <CustomerDesk customerId={id} desk={desk} showDebt={showDebt} />
      <section className="portal-panel">
        <form method="get" className="portal-filters" aria-label="Period kupovine">
          <DateRangeField nameOd="from" nameDo="to" defaultOd={period.from} defaultDo={period.to} zapamti />
          <button type="submit" className="portal-button" data-variant="secondary">
            Primenite
          </button>
        </form>
        <p className="portal-footnote" role="status" style={{ padding: "0 16px 14px", margin: 0 }}>
          {isAllTime(period)
            ? "Prikazani su svi artikli koje je kupac ikada kupovao. Izaberite kraći period da vidite šta je skoro uzimao, a prestao (status „Kasni“)."
            : `Prikazani su samo artikli koje je kupac kupovao u periodu ${periodLabel(period)} Da li kasni, računa se iz cele istorije.`}
        </p>
      </section>
      <CustomerOffer
        customerId={id}
        rows={data.rows}
        today={data.today}
        canEdit
        canOrder={can(user, "customer_orders:prepare")}
        phone={desk.phones[0]?.number ?? null}
        stockDate={data.stockDate}
      />
    </>
  );
}
