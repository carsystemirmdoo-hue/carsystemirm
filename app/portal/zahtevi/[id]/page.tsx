import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/ordering/OrderDetailView";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { LiveRefresh } from "@/components/ordering/LiveRefresh";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";
import { staffOrderStamp } from "@/lib/ordering/live-stamp";
import { OfficeOrderActions } from "./OfficeOrderActions";
import { RevisionForm } from "./RevisionForm";

export const dynamic = "force-dynamic";

export default async function OrderRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}`);
  const order = await loadOrderRequest(user, id);
  if (!order) notFound();
  const stamp = await staffOrderStamp(user, order.id);

  return (
    <>
      <CrumbLabel segment={order.id} label={order.orderNumber ?? order.requestNumber} />
      <p className="kk-back">
        <Link href="/portal/zahtevi">← Svi zahtevi</Link> · <Link href={`/portal/kupci/${order.customerId}`}>Kartica kupca</Link> ·{" "}
        <Link href={`/portal/zahtevi/${order.id}/stampa`} className="portal-button" data-variant="secondary">Odštampajte zahtev</Link>
      </p>
      <section className="portal-panel">
        <OrderDetailView order={order} audience="office" />
        <OfficeOrderActions
          key={`akcije-${order.version}`}
          version={order.version}
          orderId={order.id}
          status={order.status}
          canReview={can(user, "customer_orders:review")}
          canConfirm={can(user, "customer_orders:confirm")}
          biznisoftDocumentNumber={order.biznisoftDocumentNumber}
          onRequestLines={order.onRequestLines ?? 0}
        />
        {order.pricingSource === "cenovnik" && ["submitted", "under_review", "changes_requested"].includes(order.status) && (!order.replacedBy || order.replacedBy.status === "cancelled") && can(user, "customer_orders:review") ? (
          <div className="portal-panel-body">
            <RevisionForm
              key={`izmena-${order.version}`}
              version={order.version}
              orderId={order.id}
              lines={order.lines.map((l) => ({ code: l.articleCode, name: l.articleName, unit: l.unit, quantity: String(l.quantity) }))}
              rebatesHref={can(user, "view:rabati") ? `/portal/cene/rabati-iz-faktura/kupci/${order.customerId}` : null}
            />
          </div>
        ) : null}
      </section>
      <LiveRefresh endpoint={`/api/portal/zahtevi/stanje?id=${order.id}`} stamp={stamp} what="Zahtev" />
    </>
  );
}
