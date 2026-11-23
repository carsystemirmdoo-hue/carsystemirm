import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { optionLabel } from "@/lib/pricing/paymentOptions.mjs";
import { PricingScopeError } from "@/lib/pricing/pricing-scope";
import { RebateChangeError } from "@/lib/pricing/rebate-change-service";
import { AVANS, loadRebateTable } from "@/lib/pricing/rebate-table-service";
import { RebateTable } from "./RebateTable";
import { EnableAvans } from "./EnableAvans";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { readPortalPeriod } from "@/lib/portal/period";
import { isAllTime, periodLabel } from "@/lib/portal/periodMemory.mjs";

export const dynamic = "force-dynamic";
// Čuvanje većeg broja artikala (svaki je jedno pravilo sa tragom) traje.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tabela rabata kupca (2026-11-09): svi artikli u ponudi — koje uzima i koje
 * ne — i izmena po brendu, grupi, artiklu, izboru ili neto ceni.
 */
export default async function RebateTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; uslov?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const period = await readPortalPeriod(sp);
  const wantAvans = sp.uslov === AVANS;
  if (!UUID.test(id)) notFound();
  const user = await requireCapability("view:rabati", `/portal/cene/rabati-iz-faktura/kupci/${id}/tabela`);
  let data: Awaited<ReturnType<typeof loadRebateTable>>;
  try {
    data = await loadRebateTable(user, id, new Date(), period, wantAvans ? AVANS : null);
  } catch (error) {
    if (error instanceof PricingScopeError) forbidden();
    if (error instanceof RebateChangeError) notFound();
    throw error;
  }

  const hasAvans = data.avansApproved;
  const tabHref = (c: string | null) => {
    const q = new URLSearchParams();
    if (period.from) q.set("from", period.from);
    if (period.to) q.set("to", period.to);
    if (c) q.set("uslov", c);
    const s = q.toString();
    return `/portal/cene/rabati-iz-faktura/kupci/${id}/tabela${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Rabati kupca"
        title={data.customer.name}
        description="Svi artikli u ponudi: koje kupac uzima i koje ne, važeći rabat i neto cena. Rabat menjate za ceo brend, grupu, jedan artikal ili izabrane artikle; neto cenu po artiklu."
        meta={
          data.paymentOptions.length ? (
            <span>Odobrene opcije plaćanja: {data.paymentOptions.map((c) => optionLabel(c)).join(", ")}.</span>
          ) : undefined
        }
        actions={
          <>
            {seesAllCustomers(user) ? (
              <Link className="rr-link" href={`/portal/cene/rabati-iz-faktura/kupci/${id}`}>← Rabati iz faktura</Link>
            ) : (
              <Link className="rr-link" href="/portal/cene/rabati-iz-faktura/kupci">← Rabati kupaca</Link>
            )}
            <Link className="rr-link" href={`/portal/kupci/${id}/preporuke`}>Preporuke i ponuda</Link>
            <Link className="rr-link" href={`/portal/kupci/${id}`}>Kartica kupca</Link>
          </>
        }
      />
      <section className="portal-panel">
        <nav className="portal-tabs rr-condition-tabs" aria-label="Uslov plaćanja">
          <Link href={tabHref(null)} data-active={!wantAvans} aria-current={!wantAvans ? "page" : undefined}>
            Odloženo plaćanje (osnovni rabat)
          </Link>
          <Link href={tabHref(AVANS)} data-active={wantAvans} aria-current={wantAvans ? "page" : undefined}>
            Avansno plaćanje{hasAvans ? "" : " (nije odobreno)"}
          </Link>
        </nav>
        <p className="portal-footnote">
          {wantAvans
            ? "Menjate rabat uz AVANSNO plaćanje. Artikal bez svog avansnog rabata ima osnovni rabat; kolona „Odloženo (osnovni)“ ga prikazuje pored."
            : hasAvans
              ? "Menjate osnovni rabat: važi za odloženo plaćanje i za avans kod artikala bez posebnog avansnog rabata. Kolona „Avans“ pokazuje avansni rabat pored."
              : "Menjate osnovni rabat (odloženo plaćanje). Kupcu avans još nije odobren — kolona „Avans“ zato pokazuje isti rabat. Avansni rabat upisujete na kartici „Avansno plaćanje“."}
        </p>
        {wantAvans && !hasAvans ? (
          data.canEnableAvans ? (
            <EnableAvans customerId={id} needsDeferred={!data.hasDeferred} />
          ) : (
            <p className="portal-readiness-note" role="status">
              Kupcu avans nije odobren. Predložite „Avansno plaćanje“ na <Link href={`/portal/cene/rabati-iz-faktura/kupci/${id}#opcije-placanja`}>stranici rabata kupca</Link>; posle odobrenja ovde upisujete avansni rabat.
            </p>
          )
        ) : null}
        <form method="get" className="portal-inline-form">
          {wantAvans ? <input type="hidden" name="uslov" value={AVANS} /> : null}
          <DateRangeField nameOd="from" nameDo="to" defaultOd={period.from} defaultDo={period.to} zapamti />
          <button type="submit" className="portal-button" data-variant="primary">
            Prikažite
          </button>
        </form>
        <p className="portal-footnote">
          {isAllTime(period)
            ? "„Uzima“ znači da je kupac artikal kupio u poslednjih 365 dana. Izaberite period da biste videli šta je uzimao u tom periodu."
            : `„Uzima“ znači da je kupac artikal kupio u periodu ${periodLabel(period).replace(/\.$/, "")}; broj uz „Uzima“ je broj dana kupovine u periodu. Rabati i cene se ne menjaju izborom perioda.`}
        </p>
      </section>
      <RebateTable key={`${period.from ?? ""}|${period.to ?? ""}|${data.condition ?? ""}`} condition={data.condition} otherLabel={data.otherLabel} buysLabel={isAllTime(period) ? "Uzima (12 meseci)" : "Uzima (u periodu)"} customerId={id} rows={data.rows} today={data.today} canPropose={data.canPropose} canApprove={data.canApprove} />
    </>
  );
}
