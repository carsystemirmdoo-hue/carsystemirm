import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { loadLagerList } from "@/lib/stock/lager-list-service";
import { LagerTable } from "./LagerTable";

export const metadata = { title: "Lager lista" };

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:lager_lista", "/portal/lager-lista");
  const data = await loadLagerList();
  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Lager lista"
        description="Brz pregled artikla: ukucajte šifru ili deo naziva i odmah vidite stanje, pakovanje, VP cenu i robu u dolasku."
      />
      <LagerTable data={data} />
    </>
  );
}
