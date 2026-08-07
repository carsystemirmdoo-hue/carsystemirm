import { OrderDetail } from "@/features/portal/OrdersModule";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail orderId={id}/>;
}
