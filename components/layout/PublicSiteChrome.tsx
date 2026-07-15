"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";

export function PublicSiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const usesCustomChrome =
    pathname.startsWith("/site-u-pripremi") || pathname.startsWith("/interaction-demo");

  if (usesCustomChrome) return <>{children}</>;

  return (
    <>
      <Header />
      {children}
    </>
  );
}
