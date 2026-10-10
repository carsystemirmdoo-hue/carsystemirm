import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { normalizeCustomerReturn } from "@/lib/authz/redirects.mjs";
import { customerLandingAfterLogin } from "@/lib/authz/customer-landing";
import { isRememberEnabled } from "@/lib/auth/rememberRules.mjs";
import { CustomerLoginForm } from "./CustomerLoginForm";
import "../../portal/portal.css";
import "../../portal/panel.css";

export const metadata: Metadata = {
  title: "Prijava kupca · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; poruka?: string }>;
}) {
  const { callbackUrl, poruka } = await searchParams;
  // Samo poznati kodovi; slobodan tekst iz adrese se nikad ne prikazuje.
  const notice =
    poruka === "odjava-svi"
      ? "Odjavljeni ste sa svih uređaja."
      : poruka === "lozinka"
        ? "Lozinka je promenjena. Prijavite se novom lozinkom — ostali uređaji su odjavljeni."
        : poruka === "odjava"
          ? "Odjavljeni ste."
          : null;
  const session = await getCustomerSession();

  if (session) {
    redirect(customerLandingAfterLogin(normalizeCustomerReturn(callbackUrl)));
  }

  return <CustomerLoginForm callbackUrl={callbackUrl ?? ""} rememberAvailable={isRememberEnabled()} notice={notice} />;
}
