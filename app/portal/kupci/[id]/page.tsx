import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireCustomerAccess } from "@/lib/authz/session";
import { listCustomerAssignees, listSalesReps } from "@/lib/partners/assignment-service";
import { loadCustomerProfile } from "@/lib/recommendations/customer-profile";
import { AssignmentPanel } from "./AssignmentPanel";
import { loadArticleIdentities } from "@/lib/ordering/ordering-service";
import { loadCrossSell } from "@/lib/recommendations/cross-sell";
import { CustomerArticles, CustomerCrossSell, CustomerMethod, CustomerSuggestions, CustomerSummary } from "./CustomerCard";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ redosled?: string }>;
}) {
  const { id } = await params;
  // Poređenje sa dosadašnjim redosledom; sve ostalo (osim „dosadasnji") je R1.
  const order = (await searchParams).redosled === "dosadasnji" ? "dosadasnji" : "r1";
  const user = await requireCapability("view:kupci", `/portal/kupci/${id}`);

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
  const [assignees, reps, profile, crossSell] = await Promise.all([
    listCustomerAssignees(customer.id),
    canManageAssignments ? listSalesReps() : Promise.resolve([]),
    showSignals ? loadCustomerProfile(customer.id) : Promise.resolve(null),
    // Opseg je već proveren iznad (`requireCustomerAccess`); predlog je deo iste kartice.
    showSignals ? loadCrossSell([customer.id]).then((m) => m.get(customer.id) ?? null) : Promise.resolve(null),
  ]);

  const identities = profile
    ? Object.fromEntries(await loadArticleIdentities(profile.articles.map((a) => a.articleCode)))
    : {};

  return (
    <>
      <CrumbLabel segment={customer.id} label={customer.name} />
      <PageHeader
        eyebrow="Kupci"
        title={customer.name}
        description={`PIB ${customer.pib}${customer.city ? ` · ${customer.city}` : ""}`}
      />
      {profile ? (
        <CustomerSummary profile={profile} assignees={assignees.map((a) => a.name)} />
      ) : null}
      {profile ? <CustomerSuggestions profile={profile} identities={identities} order={order} /> : null}
      {profile ? <CustomerArticles profile={profile} identities={identities} /> : null}
      {profile && crossSell ? (
        <CustomerCrossSell
          crossSell={crossSell}
          names={Object.fromEntries(profile.articles.map((a) => [a.articleCode, a.articleName ?? a.articleCode]))}
        />
      ) : null}
      <AssignmentPanel
        customerId={customer.id}
        assignees={assignees}
        reps={reps}
        canManage={canManageAssignments}
      />
      {profile ? <CustomerMethod profile={profile} /> : null}
      {/*
       * Naplata se ne prikazuje: fakture ne nose ni dospeće ni uplatu. Ranija
       * velika poruka „profil čeka uvezene fakture" stajala je i ispod stvarnih
       * dokumenata; ovde ostaje samo tačna rečenica o onome što zaista fali.
       */}
      <p className="portal-footnote">
        Naplata i dugovanja se ne prikazuju: izvor uplata i datuma dospeća nije povezan.
      </p>
    </>
  );
}
