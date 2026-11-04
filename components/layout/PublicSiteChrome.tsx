"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountOnlyHeader } from "@/components/layout/AccountOnlyHeader";
import { Header } from "@/components/layout/Header";
import { CustomerCartDrawer } from "@/components/cart/CustomerCartDrawer";
import { ProductSearchProvider } from "@/components/search/ProductSearchProvider";

export function PublicSiteChrome({ children, publicSiteOpen = true }: { children: ReactNode; publicSiteOpen?: boolean }) {
  const pathname = usePathname();
  const usesCustomChrome =
    pathname.startsWith("/site-u-pripremi") ||
    pathname.startsWith("/interaction-demo") ||
    pathname.startsWith("/social-exports") ||
    pathname.startsWith("/portal");

  if (usesCustomChrome) return <>{children}</>;

  // Sajt u pripremi: prijava bez javnog menija (on bi vodio na „sajt u pripremi“).
  if (!publicSiteOpen && pathname.startsWith("/prijava")) {
    return (
      <>
        <AccountOnlyHeader />
        {children}
      </>
    );
  }

  /*
   * Nalog kupca uvek dobija javni meni: prijavljenom kupcu je sajt otvoren i dok
   * je „u pripremi“ (odluka vlasnika 15. 10. 2026, `siteOpenForCustomer`), pa iz
   * naloga ide na bilo koju stranu sajta, a korpa firme ostaje na serveru.
   */
  const siteOpenHere = publicSiteOpen || pathname.startsWith("/kupac");

  /*
   * Provider obuhvata i Header i sadržaj stranice, jer obe strane otvaraju
   * ISTI panel pretrage. Sam panel se ne montira dok se pretraga ne otvori, pa
   * ovaj omotač ne dodaje ništa u početni payload osim konteksta.
   */
  return (
    <ProductSearchProvider>
      <Header />
      <CustomerCartDrawer publicSiteOpen={siteOpenHere} />
      {children}
    </ProductSearchProvider>
  );
}
