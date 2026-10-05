import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { isPartnerRegistryUploadEnabled } from "@/lib/partners/gate";
import { ContactProposalForm } from "./ContactProposalForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Grupni predlog kontakata kupaca iz pregledane tabele.
 *
 * Upisuje samo naloge `requested` bez lozinke — isto što i pojedinačni predlog
 * na „Nalozi kupaca". Potvrda osobe i poziv ostaju posebni koraci.
 */
export default async function ContactProposalPage() {
  await requireCapability("customer_accounts:manage", "/portal/kupci/kontakti");
  return (
    <>
      <PageHeader
        eyebrow="Kupci"
        title="Grupni predlog kontakata"
        description={
          "Pregledana tabela se prvo proverava (bez upisa), a zatim se upisuju samo potvrđeni redovi kao predlozi kontakata. " +
          "Lozinke, potvrda osobe i pozivi se ovde ne prave."
        }
      />
      <ContactProposalForm applyEnabled={isPartnerRegistryUploadEnabled()} />
    </>
  );
}
