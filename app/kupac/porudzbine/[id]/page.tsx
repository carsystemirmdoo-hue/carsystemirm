import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/ordering/OrderDetailView";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { LiveRefresh } from "@/components/ordering/LiveRefresh";
import { loadCustomerOrder } from "@/lib/ordering/ordering-service";
import { customerOrderStamp } from "@/lib/ordering/live-stamp";
import { money } from "@/lib/ordering/panelFormat.mjs";
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
  // Prethodna verzija (iste firme) samo za označavanje izmena u predlogu.
  const [stamp, previous] = await Promise.all([
    customerOrderStamp(session.customerId, order.id),
    order.replaces ? loadCustomerOrder(session.customerId, order.replaces.id) : Promise.resolve(null),
  ]);
  const old = Boolean(order.current && order.current.id !== order.id);
  const allOnRequest = order.lines.length > 0 && order.lines.every((l) => l.priceStatus === "na_upit");
  const grossLabel = allOnRequest
    ? "iznos još nije utvrđen (sve stavke su na upit)"
    : `${money(order.grossTotal, order.currency)} sa PDV-om${order.onRequestLines ? ", bez stavki na upit" : ""}`;

  return (
    <>
      <OrderDetailView
        order={order}
        audience="customer"
        previous={previous}
        notice={
          sp.poslato === "1" && order.status === "submitted" ? (
            <p className="pn-note" data-tone="success" role="status">
              Zahtev {order.requestNumber} je poslat. Ovde pratite njegov status; stranica se sama osvežava.
            </p>
          ) : null
        }
        actions={
          old ? null : (
            <CustomerOrderActions
              key={order.version}
              version={order.version}
              orderId={order.id}
              status={order.status}
              grossLabel={grossLabel}
              pendingProposal={order.replacedBy && order.replacedBy.status !== "cancelled" ? order.replacedBy : null}
            />
          )
        }
      />
      <LiveRefresh endpoint={`/api/kupac/zahtevi/stanje?id=${order.id}`} stamp={stamp} what="Zahtev" />
    </>
  );
}
