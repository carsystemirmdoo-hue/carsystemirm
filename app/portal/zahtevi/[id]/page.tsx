import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/ordering/OrderDetailView";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";
import { OfficeOrderActions } from "./OfficeOrderActions";

export const dynamic = "force-dynamic";

export default async function OrderRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}`);
  const order = await loadOrderRequest(user, id);
  if (!order) notFound();

  return (
    <>
      <p className="kk-back">
        <Link href="/portal/zahtevi">← Svi zahtevi</Link> · <Link href={`/portal/kupci/${order.customerId}`}>Kartica kupca</Link>
      </p>
      <section className="portal-panel">
        <OrderDetailView order={order} audience="office" />
        <OfficeOrderActions
          orderId={order.id}
          status={order.status}
          canReview={can(user, "customer_orders:review")}
          canConfirm={can(user, "customer_orders:confirm")}
          biznisoftDocumentNumber={order.biznisoftDocumentNumber}
        />
      </section>
    </>
  );
}
