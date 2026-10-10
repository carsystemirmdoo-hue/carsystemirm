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
  const [stamp, previous] = await Promise.all([
    staffOrderStamp(user, order.id),
    order.replaces ? loadOrderRequest(user, order.replaces.id) : Promise.resolve(null),
  ]);
  const old = Boolean(order.current && order.current.id !== order.id);
  const canReview = can(user, "customer_orders:review");
  const revisable =
    !old &&
    order.pricingSource === "cenovnik" &&
    ["submitted", "under_review", "changes_requested"].includes(order.status) &&
    (!order.replacedBy || order.replacedBy.status === "cancelled") &&
    canReview;
  const allOnRequest = order.lines.length > 0 && order.lines.every((l) => l.priceStatus === "na_upit");

  return (
    <>
      <CrumbLabel segment={order.id} label={order.orderNumber ?? order.requestNumber} />
      <OrderDetailView
        order={order}
        audience="office"
        previous={previous}
        headActions={
          <>
            <Link href={`/portal/kupci/${order.customerId}`} className="pn-btn" data-size="sm">
              Kartica kupca
            </Link>
            <Link href={`/portal/zahtevi/${order.id}/stampa`} className="pn-btn" data-size="sm">
              Štampa A4
            </Link>
          </>
        }
        actions={
          old ? null : (
            <OfficeOrderActions
              key={`akcije-${order.version}`}
              version={order.version}
              orderId={order.id}
              status={order.status}
              canReview={canReview}
              canConfirm={can(user, "customer_orders:confirm")}
              biznisoftDocumentNumber={order.biznisoftDocumentNumber}
              onRequestLines={order.onRequestLines ?? 0}
              revisable={revisable}
            />
          )
        }
      />
      {revisable ? (
        <div className="pn" style={{ marginTop: 16 }}>
          <RevisionForm
            key={`izmena-${order.version}`}
            version={order.version}
            orderId={order.id}
            originalGross={allOnRequest ? null : order.grossTotal}
            lines={order.lines.map((l) => ({ code: l.articleCode, name: l.articleName, unit: l.unit, quantity: String(l.quantity) }))}
            rebatesHref={can(user, "view:rabati") ? `/portal/cene/rabati-iz-faktura/kupci/${order.customerId}` : null}
          />
        </div>
      ) : null}
      <LiveRefresh endpoint={`/api/portal/zahtevi/stanje?id=${order.id}`} stamp={stamp} what="Zahtev" />
    </>
  );
}
