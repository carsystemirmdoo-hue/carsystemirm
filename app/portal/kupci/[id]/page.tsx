import { CustomerDetail } from "@/features/portal/CustomersModule";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetail customerId={id}/>;
}
