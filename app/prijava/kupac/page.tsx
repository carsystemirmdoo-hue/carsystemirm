import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/authz/customer-session";
import {
  CUSTOMER_HOME_ROUTE,
  normalizeCustomerCallback,
} from "@/lib/authz/redirects.mjs";
import { CustomerLoginForm } from "./CustomerLoginForm";
import "../../portal/portal.css";

export const metadata: Metadata = {
  title: "Prijava kupca · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const session = await getCustomerSession();

  if (session) {
    redirect(normalizeCustomerCallback(callbackUrl) ?? CUSTOMER_HOME_ROUTE);
  }

  return <CustomerLoginForm callbackUrl={callbackUrl ?? ""} />;
}
