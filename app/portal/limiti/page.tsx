import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability("view:limiti", "/portal/limiti");

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Kreditni limiti"
        description="Predlog sistema, odobreni limit, ko je odobrio, kada i sa kojim obrazloženjem."
      />
      <PhaseNotice
        icon="prices"
        title="Ekran čeka izvor podataka"
        summary="Limit je savetodavan i ne blokira prodaju. Predlog se računa iz proverenih podataka o prometu; kašnjenje i procenat plaćanja se ne koriste dok ne postoji izvor uplata. Konačan limit odobrava Vlasnik."
        requires={[
          "Uvoz faktura iz BiznisSoft izvoza — bez njega nema nijednog prodajnog podatka.",
          "Odluka Vlasnika je uvek poslednji korak — nijedan algoritam ne menja odobreni limit sam.",
        ]}
        availability="Dostupno nakon povezivanja BiznisSoft izvoza i statusa plaćanja"
      />
    </>
  );
}
