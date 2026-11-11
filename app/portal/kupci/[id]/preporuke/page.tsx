import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/portal/PortalPrimitives";
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
export default async function CustomerOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireCapability("view:preporuke", `/portal/kupci/${id}/preporuke`);
  const showDebt = can(user, "view:dugovanja");
  const refreshProblem = showDebt ? await autoRefreshReceivables(user.id) : null;
  let data: Awaited<ReturnType<typeof loadCustomerOffer>>;
  let desk: Awaited<ReturnType<typeof loadCustomerDesk>>;
  try {
    [data, desk] = await Promise.all([loadCustomerOffer(user, id), loadCustomerDesk(user, id)]);
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
