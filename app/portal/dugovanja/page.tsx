import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:dugovanja", "/portal/dugovanja");

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Dugovanja"
        description="Starost potraživanja i otvorene stavke po kupcu i komercijalisti."
      />
      <PhaseNotice
        icon="orders"
        title="Ekran čeka izvor podataka"
        summary="Fakture ne sadrže podatak o plaćanju. Dok se ne poveže proveren izvor uplata, ovaj ekran ne prikazuje ni dugovanje, ni kašnjenje, ni procenat plaćenih na vreme — takve vrednosti bi bile izmišljene."
        requires={[
          "Proveren izvor uplata (izvod ili knjigovodstveni izvoz sa datumom plaćanja).",
          "Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka.",
          "Integracija sa bankom nije predviđena i nije uslov.",
        ]}
        phase="kada izvor uplata bude dostupan"
      />
    </>
  );
}
