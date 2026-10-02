import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { isPartnerRegistryUploadEnabled } from "@/lib/partners/gate";
import { LinkReviewForm } from "./LinkReviewForm";

export const dynamic = "force-dynamic";
// Prenos dva fajla; isto ograničenje kao uvoz registra.
export const maxDuration = 60;

/**
 * Veze „šifra sa fakture → kupac" za talas istorijskih faktura.
 *
 * Plan i pregledna tabela nastaju lokalno (`scripts/ops/customer-link.mts plan`)
 * i ne upisuju ništa. Ovde se primenjuju SAMO potvrđeni redovi, kroz prijavljenog
 * korisnika sa drugim faktorom — akter u tragu je on, ne ime iz tabele.
 */
export default async function LinkReviewPage() {
  await requireCapability("mappings:manage", "/portal/kupci/veze");
  return (
    <>
      <PageHeader
        eyebrow="Kupci"
        title="Veze šifara za talas faktura"
        description={
          "Pregledana tabela predloga se prvo proverava (bez upisa), a zatim primenjuju samo potvrđeni redovi. " +
          "Nalozi za prijavu kupaca se ovde ne prave."
        }
      />
      <LinkReviewForm applyEnabled={isPartnerRegistryUploadEnabled()} />
    </>
  );
}
