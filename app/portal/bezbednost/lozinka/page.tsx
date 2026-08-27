import type { Metadata } from "next";
import { signOutAction } from "@/app/portal/actions";
import { PageHeader } from "@/components/portal/PortalPrimitives";
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
  await requireFullPortalUser("/portal/bezbednost/lozinka");

  return (
    <>
      <PageHeader
        eyebrow="Bezbednost"
        title="Lozinka"
        description="Promena sopstvene lozinke uz potvrdu kodom iz aplikacije."
      />
      <PasswordChange onSignOut={signOutAction} />
    </>
  );
}
