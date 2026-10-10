import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/ordering/OrderDetailView";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { LiveRefresh } from "@/components/ordering/LiveRefresh";
import { loadCustomerOrder } from "@/lib/ordering/ordering-service";
import { customerOrderStamp } from "@/lib/ordering/live-stamp";
import { CustomerOrderActions } from "./CustomerOrderActions";

export const dynamic = "force-dynamic";

/*
 * ID iz adrese se proverava ZAJEDNO sa firmom iz sesije: tuđ i nepostojeći
 * zahtev daju isti odgovor (404).
 */
export default async function CustomerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ poslato?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await requireCustomerSession(`/kupac/porudzbine/${encodeURIComponent(id)}`);
  const order = await loadCustomerOrder(session.customerId, id);
  if (!order) notFound();
  const stamp = await customerOrderStamp(session.customerId, order.id);

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          {sp.poslato === "1" && order.status === "submitted" ? (
            <p className="kk-sent" role="status">
              Zahtev {order.requestNumber} je poslat. Ovde pratite njegov status.
            </p>
          ) : null}
        </div>
        <Link href="/kupac/porudzbine" className="portal-section-link">← Svi zahtevi</Link>
      </div>
      <OrderDetailView order={order} audience="customer" />
      <CustomerOrderActions
        key={order.version}
        version={order.version}
        orderId={order.id}
        status={order.status}
        pendingProposal={order.replacedBy && order.replacedBy.status !== "cancelled" ? order.replacedBy : null}
      />
      <LiveRefresh endpoint={`/api/kupac/zahtevi/stanje?id=${order.id}`} stamp={stamp} what="Zahtev" />
    </section>
  );
}
