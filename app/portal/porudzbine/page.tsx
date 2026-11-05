import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const metadata = { title: "Porudžbine" };

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:porudzbine", "/portal/porudzbine");

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Porudžbine"
        description="Porudžbine prema dobavljačima, potvrđene količine, očekivani dolazak i status."
      />
      <PhaseNotice
        icon="approval"
        title="Ekran čeka izvor podataka"
        summary="Već poručene količine ulaze u sledeću preporuku nabavke da se ista roba ne bi poručila dvaput. Porudžbine kreira i potvrđuje isključivo Vlasnik."
        requires={[
          "Predlog nabavke (ekran Nabavka) — čeka istoriju dana bez zalihe; stanje se već uvozi kroz Uvoz lagera.",
        ]}
        availability="Dostupno posle predloga nabavke"
      />
    </>
  );
}
