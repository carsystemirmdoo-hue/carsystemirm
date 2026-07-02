"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";

export function PublicSiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const usesCustomChrome = pathname === "/" || pathname.startsWith("/preview");

  if (usesCustomChrome) return <>{children}</>;

  return (
    <>
      <Header />
      {children}
    </>
  );
}
