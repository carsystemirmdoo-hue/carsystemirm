import type { Metadata } from "next";
import { ResetForm } from "./ResetForm";
import "../../portal/portal.css";

export const metadata: Metadata = {
  title: "Nova lozinka · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

/*
 * Nikad iz keša i nikad prerenderovano.
 *
 * Strana prima kod i novu lozinku. `no-store` zaglavlje za `/prijava/reset`
 * postavlja `next.config.ts`; `force-dynamic` sprečava da odgovor postane deo
 * statičkog izlaza.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Javna strana: otvara je čovek koji ne može da se prijavi.
 *
 * Namerno NE proverava sesiju i ne preusmerava prijavljene. Nalog čija je
 * lozinka kompromitovana često ima i otvorenu tuđu sesiju; preusmeravanje bi
 * pravog vlasnika sprečilo da to popravi.
 */
export default function PasswordResetPage() {
  return <ResetForm />;
}
