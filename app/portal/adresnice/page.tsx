import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:adresnice", "/portal/adresnice");

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Adresnice"
        description="Preuzimanje adresnica, objedinjavanje u jedan dokument i štampa."
      />
      <PhaseNotice
        icon="print"
        title="Ekran čeka izvor podataka"
        summary="Adresnice stižu iz BEX-a posle uspešno kreirane pošiljke, pa ovaj ekran zavisi od Otpreme."
        requires={[
          "BEX pristupni podaci (BEX_CLIENT_ID, BEX_API_KEY) i uključen prekidač FEATURE_BEX.",
        ]}
        phase="faza 3"
      />
    </>
  );
}
