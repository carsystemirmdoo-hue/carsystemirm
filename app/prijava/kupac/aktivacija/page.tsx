import type { Metadata } from "next";
import { CUSTOMER_PASSWORD_MIN } from "@/lib/customers/invitation-service";
import { PasswordSetupForm } from "./PasswordSetupForm";
import "../../../portal/portal.css";
import "../../../portal/panel.css";

export const metadata: Metadata = {
  title: "Aktivacija naloga · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Aktivacija kupčevog naloga jednokratnim tokenom.
 *
 * Token stiže u adresi jer link mora biti otvoriv iz poruke. To je prihvatljivo
 * samo zato što je jednokratan, kratkotrajan i u bazi postoji isključivo kao
 * HMAC otisak — a stranica je `noindex, nofollow`.
 */
export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <PasswordSetupForm
      token={token ?? ""}
      minLength={CUSTOMER_PASSWORD_MIN}
    />
  );
}
