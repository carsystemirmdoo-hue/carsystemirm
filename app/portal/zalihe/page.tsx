import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:zalihe", "/portal/zalihe");

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Zalihe"
        description="Stanje po artiklu, dani bez zalihe i istorija dostupnosti — osnova za preporuku nabavke."
      />
      <PhaseNotice
        icon="package"
        title="Ekran čeka izvor podataka"
        summary="U postojećem sistemu ne postoji izvor stanja zaliha. Fakture ga ne sadrže i ne mogu ga zameniti."
        requires={[
          "Izvor stanja zaliha — fakture ga ne sadrže, potreban je poseban uvoz (faza 4).",
          "Datoteka sa trenutnim stanjem (XLSX ili CSV) ili pristup postojećoj evidenciji lagera.",
          "Istorija dana bez zalihe — bez nje preporuka nabavke ostaje označena kao nepouzdana.",
        ]}
        phase="faza 4"
      />
    </>
  );
}
