import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadIncoming, settleArrivals } from "@/lib/procurement/incoming-service";
import { NewOrder } from "./NewOrder";
import { OrderList } from "./OrderList";

export const metadata = { title: "Roba u dolasku" };

export const dynamic = "force-dynamic";

/**
 * Roba u dolasku (0064; 2026-11-12): porudžbine dobavljačima sa rokom i odbrojavanjem. Pre prikaza
 * se stavke porede sa važećim lagerom (povećanje stanja = stiglo); poziv je bezopasan i ponovljiv.
 */
export default async function Page() {
  const user = await requireCapability("view:porudzbine", "/portal/porudzbine");
  await settleArrivals().catch(() => undefined);
  const data = await loadIncoming();
  const canEdit = can(user, "procurement:order_create");
  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Roba u dolasku"
        description="Porudžbine dobavljačima posle potvrde: šta je poručeno, kada stiže i šta kasni. Kada nov lager pokaže veće stanje artikla, stavka se sama označi kao stigla."
      />
      {canEdit ? <NewOrder today={data.today} /> : null}
      <OrderList orders={data.orders} canEdit={canEdit} stockDate={data.stockDate} />
    </>
  );
}
