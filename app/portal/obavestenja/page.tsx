import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:obavestenja", "/portal/obavestenja");

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Obaveštenja"
        description="Trajni zapisi sa stanjima: aktivno, pročitano, odloženo, ručno zatvoreno i automatski rešeno."
      />
      <PhaseNotice
        icon="bell"
        title="Ekran čeka izvor podataka"
        summary="Upozorenja vezana za plaćanje se ne generišu dok ne postoji proveren izvor uplata — sistem ne sme da javlja kašnjenje koje ne može da dokaže."
        requires={[
          "Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka.",
          "Izvor uplata za deo upozorenja koja se tiču naplate.",
        ]}
        phase="faza 5"
      />
    </>
  );
}
