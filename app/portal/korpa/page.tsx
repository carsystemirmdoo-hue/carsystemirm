import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { CartPage } from "@/components/cart/CartPage";
import { requireUser } from "@/lib/authz/session";
import { getPortalCommerceAccess } from "@/lib/commerce/portal-commerce";

export const metadata: Metadata = {
  title: "Korpa · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  // Direktno otvaranje adrese ne sme zaobići kapiju.
  await requireUser("/portal/korpa");
  const commerce = await getPortalCommerceAccess();
  if (!commerce.allowed) forbidden();

  return <CartPage />;
}
