import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { COVER_CHOICES, HISTORY_DAYS, loadProcurement } from "@/lib/procurement/procurement-service";
import { ProcurementTable } from "./ProcurementTable";
import { KupacTrazioForm, TrazenoList } from "./Trazeno";
import { listOpenStockRequests } from "@/lib/stock/stock-requests";

export const metadata = { title: "Nabavka" };

export const dynamic = "force-dynamic";

/**
 * Nabavka (2026-11-10): predlog količina po brendu iz prodaje i važećeg lagera, kolona
 * „Poručujem“ za konačnu odluku i fajl porudžbine dobavljaču (samo šifra, naziv, količina, JM).
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("view:nabavka", "/portal/nabavka");
  const sp = await searchParams;
  const raw = Number(typeof sp.dana === "string" ? sp.dana : "");
  const coverDays = (COVER_CHOICES as readonly number[]).includes(raw) ? raw : 60;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const [data, requests] = await Promise.all([loadProcurement({ coverDays, from: one("od"), to: one("do") }), listOpenStockRequests()]);

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Nabavka"
        description="Izaberite brend, proverite predlog i u koloni „Poručujem“ upišite koliko poručujete. Fajl za dobavljača sadrži samo šifru, naziv i količinu."
      />
      <ProcurementTable data={data} historyDays={HISTORY_DAYS} coverChoices={[...COVER_CHOICES]} canExport={can(user, "procurement:prepare")} canRecord={can(user, "procurement:order_create")} />
      <section className="portal-panel" id="trazeno">
        <div className="portal-section-header">
          <div>
            <h2>Traženo — nema na stanju ({requests.length})</h2>
            <p>
              Upisuje se samo kada kupac poruči artikal kog potvrđen lager pokazuje sa 0, i ručno dugmetom „Kupac tražio“.
              Artikal koga nema u izvozu lagera se ne beleži. U tabeli iznad isti artikal nosi oznaku „traženo“.
            </p>
          </div>
        </div>
        <div className="portal-panel-body">
          <KupacTrazioForm />
        </div>
        <TrazenoList rows={requests} canResolve={can(user, "view:nabavka")} />
      </section>
    </>
  );
}
