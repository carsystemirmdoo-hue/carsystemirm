import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireCustomerAccess } from "@/lib/authz/session";
import { listCustomerAssignees, listSalesReps } from "@/lib/partners/assignment-service";
import { loadCustomerProfile } from "@/lib/recommendations/customer-profile";
import { AssignmentPanel } from "./AssignmentPanel";
import { CustomerSignals } from "./CustomerSignals";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  const [assignees, reps, profile] = await Promise.all([
    listCustomerAssignees(customer.id),
    canManageAssignments ? listSalesReps() : Promise.resolve([]),
    showSignals ? loadCustomerProfile(customer.id) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Kupci"
        title={customer.name}
        description={`PIB ${customer.pib}${customer.city ? ` · ${customer.city}` : ""}`}
      />
      <AssignmentPanel
        customerId={customer.id}
        assignees={assignees}
        reps={reps}
        canManage={canManageAssignments}
      />
      {profile ? <CustomerSignals profile={profile} /> : null}
      <PhaseNotice
        icon="customers"
        title="Profil kupca čeka uvezene fakture"
        summary="Kartice prometa, faktura, povrata i aktivnosti se popunjavaju iz uvoza. Pokazatelji naplate ostaju nedostupni dok ne postoji proveren izvor uplata."
        requires={[
          "Uvoz faktura iz BiznisSoft izvoza (faza 2).",
          "Proveren izvor uplata za sve što se tiče dugovanja i kašnjenja.",
        ]}
        phase="faza 2"
      />
    </>
  );
}
