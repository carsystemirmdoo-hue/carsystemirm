import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireCustomerAccess } from "@/lib/authz/session";
import { isUuid } from "@/lib/sales/filterInput.mjs";
import { listCustomerAssignees, listSalesReps } from "@/lib/partners/assignment-service";
import { loadCustomerProfile } from "@/lib/recommendations/customer-profile";
import { AssignmentPanel } from "./AssignmentPanel";
import { loadArticleIdentities } from "@/lib/ordering/ordering-service";
import { loadCrossSell } from "@/lib/recommendations/cross-sell";
import { CustomerStatusPanel } from "./CustomerStatusPanel";
import { CustomerDesk } from "@/components/portal/CustomerDesk";
import { loadCustomerDesk } from "@/lib/sales-tools/customer-desk-service";
import { CustomerPeriod } from "./CustomerPeriod";
import { KupacTrazioForm } from "@/app/portal/nabavka/Trazeno";
import { readPortalPeriod } from "@/lib/portal/period";
import { loadCustomerPeriodArticles } from "@/lib/sales/customer-period-service";
import { CustomerArticles, CustomerCrossSell, CustomerMethod, CustomerSuggestions, CustomerSummary } from "./CustomerCard";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ redosled?: string; from?: string; to?: string; sve?: string }>;
}) {
  const { id } = await params;
  // Poređenje sa dosadašnjim redosledom; sve ostalo (osim „dosadasnji") je R1.
  const sp = await searchParams;
  const order = sp.redosled === "dosadasnji" ? "dosadasnji" : "r1";
  const user = await requireCapability("view:kupci", `/portal/kupci/${id}`);

  // Ne-UUID iz adrese je 404, ne greška baze (B7).
  if (!isUuid(id)) notFound();
  // Provera se radi pre bilo kakvog čitanja podataka: menjanje ID-a u adresi
  // vraća 403, a ne tuđeg kupca.
  await requireCustomerAccess(user, id);

  const rows = await getDb()
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  const customer = rows[0];
  if (!customer) notFound();

  const canManageAssignments = can(user, "assignments:manage");
  // Isto pravilo kao ekran preporuka: prekidač blokira preračun, ne prikaz.
  const showSignals = can(user, "view:preporuke");
  /*
   * Istorija kupovine (sažetak, artikli, metod) je promet kupca — vidi je ko
   * vidi Prodaju. Kancelarija je ranije dobijala praznu karticu jer je sve
   * stajalo iza `view:preporuke` (revizija 2026-10-11, B4); predlozi za
   * razgovor i proširenje i dalje traže `view:preporuke`.
   */
  const showHistory = showSignals || can(user, "view:prodaja");
  // Period (od–do) za „Najviše kupovano“ i „Prestao da uzima“: iz adrese ili zapamćen sa drugog ekrana.
  const period = await readPortalPeriod(sp);
  const [assignees, reps, profile, crossSell, periodData] = await Promise.all([
    listCustomerAssignees(customer.id),
    canManageAssignments ? listSalesReps() : Promise.resolve([]),
    showHistory ? loadCustomerProfile(customer.id) : Promise.resolve(null),
    // Opseg je već proveren iznad (`requireCustomerAccess`); predlog je deo iste kartice.
    showSignals ? loadCrossSell([customer.id]).then((m) => m.get(customer.id) ?? null) : Promise.resolve(null),
    showHistory ? loadCustomerPeriodArticles(customer.id, period) : Promise.resolve(null),
  ]);

  // Traka kupca (poziv, dugovanje, razgovor): ko radi preporuke, radi i sa ovim (opseg proveren iznad).
  const desk = can(user, "view:preporuke") ? await loadCustomerDesk(user, customer.id) : null;

  const identities = profile
    ? Object.fromEntries(await loadArticleIdentities(profile.articles.map((a) => a.articleCode)))
    : {};

  return (
    <>
      <CrumbLabel segment={customer.id} label={customer.name} />
      <PageHeader
        eyebrow="Kupci"
        title={customer.name}
        description={`PIB ${customer.pib}${customer.city ? ` · ${customer.city}` : ""}${customer.active ? "" : " · neaktivan kupac"}`}
      />
      {desk ? <CustomerDesk customerId={customer.id} desk={desk} showDebt={can(user, "view:dugovanja")} /> : null}
      {can(user, "view:preporuke") || can(user, "view:zahtevi") ? (
        <section className="portal-panel" aria-label="Kupac tražio artikal kog nema na stanju">
          <div className="portal-panel-body">
            <p className="portal-footnote">Kupac je tražio artikal kog nema na stanju? Zabeležite — vidi se na Nabavci.</p>
            <KupacTrazioForm customerId={customer.id} />
          </div>
        </section>
      ) : null}
      {!customer.active ? (
        <p className="portal-readiness-note" role="status">
          Kupac je označen kao neaktivan. Istorija i veze su dostupne; predlozi za razgovor i proširenje se ne
          prikazuju.
        </p>
      ) : null}
      {profile ? (
        <CustomerSummary profile={profile} assignees={assignees.map((a) => a.name)} inactive={!customer.active} showNextStep={showSignals} />
      ) : null}
      {can(user, "view:prodaja") || can(user, "view:zahtevi") || can(user, "view:rabati") || can(user, "view:preporuke") ? (
        <nav className="portal-panel cs-links" aria-label="Dokumenti kupca">
          {can(user, "view:preporuke") ? <Link href={`/portal/kupci/${customer.id}/preporuke`}>Preporuke i ponuda za ovog kupca →</Link> : null}
          {can(user, "view:rabati") ? <Link href={`/portal/cene/rabati-iz-faktura/kupci/${customer.id}/tabela`}>Rabati i cene ovog kupca →</Link> : null}
          {can(user, "view:prodaja") ? <Link href={`/portal/prodaja?kupac=${customer.id}`}>Prodaja i fakture ovog kupca →</Link> : null}
          {can(user, "view:zahtevi") ? (
            <Link href={`/portal/zahtevi?stanje=svi&q=${encodeURIComponent(customer.name)}`}>Zahtevi ovog kupca →</Link>
          ) : null}
        </nav>
      ) : null}
      {periodData ? (
        <CustomerPeriod
          customerId={customer.id}
          period={period}
          articles={periodData.articles}
          stopped={periodData.stopped}
          showAmounts={can(user, "view:prodaja")}
          showAll={sp.sve === "1"}
        />
      ) : null}
      {showSignals && profile && customer.active ? (
        <CustomerSuggestions profile={profile} identities={identities} order={order} />
      ) : null}
      {profile ? <CustomerArticles profile={profile} identities={identities} period={period} /> : null}
      {showSignals && profile && crossSell && customer.active ? (
        <CustomerCrossSell
          crossSell={crossSell}
          names={Object.fromEntries(profile.articles.map((a) => [a.articleCode, a.articleName ?? a.articleCode]))}
        />
      ) : null}
      <CustomerStatusPanel
        customerId={customer.id}
        active={customer.active}
        canManage={can(user, "mappings:manage")}
      />
      <AssignmentPanel
        customerId={customer.id}
        assignees={assignees}
        reps={reps}
        canManage={canManageAssignments}
      />
      {profile ? <CustomerMethod profile={profile} /> : null}
      {can(user, "view:dugovanja") && !desk ? (
        <p className="portal-footnote">
          <Link href={`/portal/dugovanja/${customer.id}`}>Dugovanje ovog kupca →</Link>
        </p>
      ) : null}
    </>
  );
}
