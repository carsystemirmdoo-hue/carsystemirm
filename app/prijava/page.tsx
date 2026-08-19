import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/features/portal/PortalLoginForm";
import { landingRouteFor } from "@/lib/authz/permissions.mjs";
import { resolvePostLoginTarget } from "@/lib/authz/redirects.mjs";
import { getPortalUser } from "@/lib/authz/session";
import "../portal/portal.css";

export const metadata: Metadata = {
  title: "Prijava · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Prijava je van `/portal` da bi zaštićene rute mogle da je koriste bez
 * kruženja kroz sopstveni layout. Odredište stiže kao `callbackUrl` parametar —
 * nikada nadovezano na putanju.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const user = await getPortalUser();

  if (user) {
    redirect(resolvePostLoginTarget(callbackUrl, landingRouteFor(user)));
  }

  return <PortalLoginForm callbackUrl={callbackUrl ?? ""} />;
}
