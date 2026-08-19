"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ProductSearchProvider } from "@/components/search/ProductSearchProvider";

export function PublicSiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const usesCustomChrome =
    pathname.startsWith("/site-u-pripremi") ||
    pathname.startsWith("/interaction-demo") ||
    pathname.startsWith("/social-exports") ||
    pathname.startsWith("/portal");

  if (usesCustomChrome) return <>{children}</>;

  /*
   * Provider obuhvata i Header i sadržaj stranice, jer obe strane otvaraju
   * ISTI panel pretrage. Sam panel se ne montira dok se pretraga ne otvori, pa
   * ovaj omotač ne dodaje ništa u početni payload osim konteksta.
   */
  return (
    <ProductSearchProvider>
      <Header />
      {children}
    </ProductSearchProvider>
  );
}
