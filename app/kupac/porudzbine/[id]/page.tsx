import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/ordering/OrderDetailView";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { loadCustomerOrder } from "@/lib/ordering/ordering-service";
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
        orderId={order.id}
        status={order.status}
        pendingProposal={order.replacedBy && order.replacedBy.status !== "cancelled" ? order.replacedBy : null}
      />
    </section>
  );
}
