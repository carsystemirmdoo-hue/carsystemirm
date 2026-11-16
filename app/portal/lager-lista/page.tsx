import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { lagerCustomerPrices, lagerCustomers, loadLagerList } from "@/lib/stock/lager-list-service";
import { LagerTable } from "./LagerTable";

export const metadata = { title: "Lager lista" };

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ kupac?: string }> }) {
  const user = await requireCapability("view:lager_lista", "/portal/lager-lista");
  const { kupac } = await searchParams;
  const [data, customers] = await Promise.all([loadLagerList(), lagerCustomers(user)]);
  // Cena kupca samo za artikle iz šifarnika (nove šifre iz lagera nemaju cenovnik).
  const articleIds = data.rows.filter((r) => !r.newCode).map((r) => r.key);
  const forCustomer = kupac ? await lagerCustomerPrices(user, kupac, articleIds) : null;
  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Lager lista"
        description="Brz pregled artikla: ukucajte šifru ili deo naziva i odmah vidite stanje, pakovanje, VP cenu i robu u dolasku. Izaberite kupca da vidite i njegovu cenu."
      />
      <LagerTable data={data} customers={customers} forCustomer={forCustomer} />
    </>
  );
}
