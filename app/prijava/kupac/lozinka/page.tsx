import type { Metadata } from "next";
import { CUSTOMER_PASSWORD_MIN } from "@/lib/customers/invitation-service";
import { PasswordSetupForm } from "../aktivacija/PasswordSetupForm";
import { ResetRequestForm } from "./ResetRequestForm";
import "../../../portal/portal.css";

export const metadata: Metadata = {
  title: "Promena lozinke · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Dve stvari na istoj adresi, po tome da li token postoji:
 * bez tokena — traženje reseta; sa tokenom — postavljanje nove lozinke.
 */
export default async function CustomerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token) {
    return (
      <PasswordSetupForm
        token={token}
        mode="reset"
        minLength={CUSTOMER_PASSWORD_MIN}
      />
    );
  }
  return <ResetRequestForm />;
}
