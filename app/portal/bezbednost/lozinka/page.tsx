import type { Metadata } from "next";
import { signOutAction } from "@/app/portal/actions";
import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { readMfaStatus } from "@/lib/auth/mfa-service";
import { requireFullPortalUser } from "@/lib/authz/session";
import { PasswordChange } from "./PasswordChange";

export const metadata: Metadata = {
  title: "Promena lozinke · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

/*
 * Nikad iz keša: obrazac nosi trenutnu i novu lozinku. `force-dynamic` sprečava
 * prerender, a zaglavlje `no-store` postavlja `next.config.ts` za celu granu
 * `/portal/bezbednost`.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Promena sopstvene lozinke traži PUNU sesiju.
 *
 * Enrollment-only sesija ovde ne sme: ko još nije vezao drugi faktor ne može ni
 * da unese svež kod, pa bi jedini ishod bio obrazac koji uvek pada.
 */
export default async function PasswordPage() {
  const user = await requireFullPortalUser("/portal/bezbednost/lozinka");
  /*
   * Promena traži kod iz aplikacije. U režimu `enroll`/`off` nalog bez drugog
   * faktora ima pun pristup, pa bi dobio obrazac koji uvek pada sa „Podaci
   * nisu ispravni“ (pravi nalog kancelarije na kopiji od 8. 10.).
   */
  const { enabled: mfaEnabled } = await readMfaStatus(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Bezbednost"
        title="Lozinka"
        description="Promena sopstvene lozinke uz potvrdu kodom iz aplikacije."
      />
      <div className="portal-narrow">
        {mfaEnabled ? (
          <PasswordChange onSignOut={signOutAction} />
        ) : (
          <section className="portal-panel">
            <h2>Prvo uključite drugi faktor</h2>
            <p>
              Promena lozinke se potvrđuje kodom iz aplikacije za jednokratne kodove, a na
              ovom nalogu drugi faktor još nije uključen.
            </p>
            <p>
              <Link href="/portal/bezbednost/mfa">Uključite drugi faktor</Link> — za to je
              potrebna dozvola koju izdaje vlasnik.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
