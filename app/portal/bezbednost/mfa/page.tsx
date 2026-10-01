import type { Metadata } from "next";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { signOutAction } from "@/app/portal/actions";
import { requireEnrollmentUser } from "@/lib/authz/session";
import { readEnrollmentContext } from "./actions";
import { MfaEnrollment } from "./MfaEnrollment";

export const metadata: Metadata = {
  title: "Drugi faktor · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

/*
 * Nikad iz keša.
 *
 * Ova strana u nekom trenutku drži ključ za vezivanje i rezervne kodove u
 * odgovoru. Keširana kopija — u pretraživaču ili kod posrednika — značila bi da
 * povratak dugmetom „Nazad" ponovo prikaže ono što se sme videti samo jednom.
 * `force-dynamic` sprečava prerender; zaglavlje `no-store` postavlja
 * `next.config.ts` za ovu putanju.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Jedina ruta koja prima enrollment-only sesiju.
 *
 * `requireEnrollmentUser` pušta i korisnika bez potvrđenog drugog faktora —
 * inače bi u režimu `enforced` bio zaključan napolju bez načina da ga veže.
 * Sve ostale portal rute i dalje idu kroz `requireCapability`, koje takvu
 * sesiju odbija.
 */
export default async function MfaPage() {
  const user = await requireEnrollmentUser();
  const { status, grantOpen } = await readEnrollmentContext(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Bezbednost"
        title="Drugi faktor"
        description={
          status.enabled
            ? "Drugi faktor je aktivan. Ovde menjate uređaj ili izdajete nove rezervne kodove."
            : "Uz lozinku se traži i jednokratni kod iz aplikacije na Vašem telefonu."
        }
      />
      <MfaEnrollment
        accountEmail={user.email}
        mfaEnabled={status.enabled}
        // Dozvola se traži samo za prvo vezivanje. Ko već ima faktor dokazao je
        // identitet time što je prošao prijavu.
        needsGrant={!status.enabled && !grantOpen ? true : !status.enabled}
        onSignOut={signOutAction}
      />
    </>
  );
}
