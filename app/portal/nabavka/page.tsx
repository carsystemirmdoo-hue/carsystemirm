import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:nabavka", "/portal/nabavka");

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Nabavka"
        description="Izbor grupe ili brenda, pa predlog količina za period od 30 do 180 dana."
      />
      <PhaseNotice
        icon="products"
        title="Ekran čeka izvor podataka"
        summary="Preporuka se računa iz neto potrošnje podeljene brojem dana kada je artikal bio dostupan — dani bez zalihe se ne računaju kao dani bez tražnje. Bez stanja i istorije dostupnosti prikazuje se „Nedovoljno podataka za pouzdanu preporuku“."
        requires={[
          "Izvor stanja zaliha — fakture ga ne sadrže, potreban je poseban uvoz (faza 4).",
          "Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka.",
        ]}
        phase="faza 4"
      />
    </>
  );
}
