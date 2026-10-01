import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireUser } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

/**
 * Nalog postoji i prijava je uspela, ali nijedna ruta nije dozvoljena.
 * Dešava se kada je korisniku oduzeta uloga ili paket, pa navigacija ostane prazna.
 */
export default async function NoAccessPage() {
  const user = await requireUser("/portal/nemate-pristup");

  return (
    <PageHeader
      eyebrow="Pristup"
      title="Nalog još nema dodeljen pristup"
      description={`Prijavljeni ste kao ${user.name}, ali Vaša uloga trenutno ne otvara nijedan ekran. Zatražite od Gazde dodelu odgovarajućeg paketa dozvola.`}
    />
  );
}
