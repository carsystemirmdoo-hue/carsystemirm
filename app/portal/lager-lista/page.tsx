import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { can } from "@/lib/authz/permissions.mjs";
import { lagerCustomerPrices, lagerCustomers, loadLagerList } from "@/lib/stock/lager-list-service";
import { listOpenStockRequests } from "@/lib/stock/stock-requests";
import { TrazenoList } from "../nabavka/Trazeno";
import { LagerTable } from "./LagerTable";

export const metadata = { title: "Lager lista" };

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ kupac?: string }> }) {
  const user = await requireCapability("view:lager_lista", "/portal/lager-lista");
  const { kupac } = await searchParams;
  const [data, customers, mine] = await Promise.all([loadLagerList(), lagerCustomers(user), listOpenStockRequests(100, { requestedBy: user.id })]);
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
      <section className="portal-panel" id="trazeno">
        <div className="portal-section-header">
          <div>
            <h2>Vaši upisi — traženo, nema na stanju ({mine.length})</h2>
            <p>
              Dugme „Traženo“ u redu artikla beleži da je kupac tražio artikal kog nema: količina je obavezna, kupac i napomena nisu.
              {can(user, "view:zalihe") ? " Sve upise svih komercijalista vidite na Zalihama." : " Vlasnik vidi sve upise na Zalihama i označava ih kao rešene."}
            </p>
          </div>
        </div>
        <TrazenoList rows={mine} canResolve={false} />
      </section>
    </>
  );
}
