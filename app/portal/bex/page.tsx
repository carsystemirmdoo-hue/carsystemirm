import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:bex", "/portal/bex");

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="BEX"
        description="Pošiljke, statusi i troškovi isporuke po kupcu, komercijalisti i pojedinačnoj pošiljci."
      />
      <PhaseNotice
        icon="truck"
        title="Ekran čeka izvor podataka"
        summary="Procenjeni i fakturisani trošak se vode odvojeno. Procena se nikada ne prikazuje kao potvrđeno dugovanje i ništa se ne knjiži."
        requires={[
          "BEX pristupni podaci (BEX_CLIENT_ID, BEX_API_KEY) i uključen prekidač FEATURE_BEX.",
        ]}
        phase="faza 3"
      />
    </>
  );
}
