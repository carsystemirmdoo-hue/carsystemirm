import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:izvestaji", "/portal/izvestaji");

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Izveštaji"
        description="Izvoz u XLSX, CSV i PDF, uz poštovanje filtera, sortiranja, izabranog perioda i dozvola korisnika."
      />
      <PhaseNotice
        icon="chart"
        title="Ekran čeka izvor podataka"
        summary="Izvoz nikada ne sme da sadrži redove koje korisnik ne sme da vidi, pa se gradi tek nad stvarnim podacima i proverenim opsegom."
        requires={[
          "Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka.",
        ]}
        phase="faza 2"
      />
    </>
  );
}
