import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { CustomerOfferError, loadCustomerOffer } from "@/lib/recommendations/customer-offer-service";
import { CustomerOffer } from "./CustomerOffer";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preporuke kupca i ponuda (2026-11-10), po odobrenom nacrtu. */
export default async function CustomerOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireCapability("view:preporuke", `/portal/kupci/${id}/preporuke`);
  let data: Awaited<ReturnType<typeof loadCustomerOffer>>;
  try {
    data = await loadCustomerOffer(user, id);
  } catch (error) {
    if (error instanceof CustomerOfferError) {
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
        description="Artikli koje kupac kupuje u ritmu: kada je poslednji put uzeo, kada je trebalo ponovo, po kojoj ceni i rabatu. Označite artikle i napravite ponudu u Excelu."
        meta={data.asOfDate ? <span>Obračun na dan {data.asOfDate.split("-").reverse().join(".")}.</span> : <span>Preporuke još nisu izračunate.</span>}
        actions={
          <>
            {can(user, "view:rabati") ? <Link className="rr-link" href={`/portal/cene/rabati-iz-faktura/kupci/${id}/tabela`}>Tabela rabata</Link> : null}
            <Link className="rr-link" href={`/portal/kupci/${id}`}>Kartica kupca</Link>
          </>
        }
      />
      <CustomerOffer customerId={id} rows={data.rows} today={data.today} canEdit />
    </>
  );
}
