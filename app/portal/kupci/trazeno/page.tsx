import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { customerScope } from "@/lib/sales/queries";
import { listOpenStockRequestsForCustomers } from "@/lib/stock/stock-requests";
import { arrived, TrazenoPoKupcima } from "./TrazenoPoKupcima";

export const metadata = { title: "Traženo po kupcima" };
export const dynamic = "force-dynamic";

/**
 * Podsetnik komercijalisti (2026-11-23): šta su njegovi kupci tražili, a nije bilo na stanju —
 * iz porudžbina na portalu i iz ručnih upisa „Kupac tražio“. Kada artikal stigne, red se ističe.
 */
export default async function TrazenoPoKupcimaPage() {
  const user = await requireCapability("view:kupci", "/portal/kupci/trazeno");
  const rows = await listOpenStockRequestsForCustomers(await customerScope(user), { userId: user.id });
  const customers = new Set(rows.map((r) => r.customerId ?? "")).size;
  const came = rows.filter(arrived).length;
  return (
    <>
      <PageHeader
        eyebrow="Moji kupci"
        title="Traženo po kupcima"
        description="Artikli koje su kupci tražili, a nije ih bilo na stanju (porudžbine sa portala i upisi „Kupac tražio“), poslednjih 90 dana. Kada artikal stigne na lager, piše „stiglo — javite kupcu“. Zapis se zatvara na Nabavci kada je rešen."
        meta={<span>{rows.length} artikala · {customers} kupaca{came ? ` · stiglo ${came}` : ""}</span>}
      />
      {rows.length ? (
        <TrazenoPoKupcima rows={rows} />
      ) : (
        <section className="portal-panel">
          <p className="portal-empty">Nema otvorenih zapisa za Vaše kupce u poslednjih 90 dana.</p>
        </section>
      )}
    </>
  );
}
