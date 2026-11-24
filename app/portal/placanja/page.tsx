import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { autoRefreshReceivables, recentPayments } from "@/lib/sales-tools/receivables-service";
import { RecentPayments } from "./RecentPayments";

export const metadata = { title: "Plaćanja" };
export const dynamic = "force-dynamic";

/** Izbor perioda; podrazumevano 5 dana (odluka vlasnika 2026-11-24). */
const PERIODS = [5, 10, 30] as const;

/**
 * Plaćanja (2026-11-24): ko je uplatio u poslednjih N dana, koliko i šta mu je ostalo.
 * Komercijalista vidi samo svoje kupce; vlasnik i kancelarija sve.
 */
export default async function PlacanjaPage({ searchParams }: { searchParams: Promise<{ dana?: string }> }) {
  const user = await requireCapability("view:dugovanja", "/portal/placanja");
  const { dana } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dana) ?? 5;
  const refreshProblem = await autoRefreshReceivables(user.id);
  const recent = await recentPayments(user, days);
  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Plaćanja"
        description="Ko je uplatio, koliko i šta mu je ostalo da plati. Kliknite na kupca da vidite plaćene i otvorene fakture."
        actions={
          <nav className="portal-tabs" aria-label="Period">
            {PERIODS.map((p) => (
              <Link key={p} href={p === 5 ? "/portal/placanja" : `/portal/placanja?dana=${p}`} data-active={p === days} aria-current={p === days ? "page" : undefined}>
                {p} dana
              </Link>
            ))}
          </nav>
        }
      />
      {refreshProblem ? <p className="dg-msg dg-msg--err" role="status">{refreshProblem}</p> : null}
      <RecentPayments payments={recent.payments} since={recent.since} days={days} />
    </>
  );
}
