import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:otprema", "/portal/otprema");

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Otprema"
        description="Priprema pošiljaka, broj paketa i masa, pojedinačno i grupno slanje u BEX."
      />
      <PhaseNotice
        icon="truck"
        title="Ekran čeka izvor podataka"
        summary="Radni tok magacionera je projektovan sa zaštitom od duplog slanja: ponovljeni klik, osvežavanje strane ili ponovni pokušaj mreže ne smeju da naprave drugu pošiljku za istu fakturu."
        requires={[
          "BEX pristupni podaci (BEX_CLIENT_ID, BEX_API_KEY) i uključen prekidač FEATURE_BEX.",
          "Potvrda da li BEX nudi test okruženje; ako ne nudi, koristi se jasno označen razvojni adapter.",
          "Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka.",
        ]}
        phase="faza 3"
      />
    </>
  );
}
