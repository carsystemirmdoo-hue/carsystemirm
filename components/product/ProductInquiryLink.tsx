"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useProductVariant } from "@/components/product/ProductVariantProvider";

/**
 * „Pošalji upit" za trenutno aktivnu varijantu.
 *
 * Adresa se čita iz konteksta, pa CTA nosi tačnu varijantu u sva tri slučaja
 * koja se u praksi javljaju: direktno otvoren `?varijanta=`, klik na drugu
 * karticu i povratak Back-om. Ranije je href bio izračunat na serveru i zauvek
 * je pokazivao na reprezentativnu varijantu.
 *
 * Izgled nije ugrađen — klasa stiže spolja, pa isti ugovor koriste i hero i
 * završni CTA, bez dupliranja logike.
 */
export function ProductInquiryLink({
  children,
  className,
  cursor,
}: {
  children: ReactNode;
  className?: string;
  cursor?: string;
}) {
  const { inquiryHref } = useProductVariant();

  return (
    <Link className={className} href={inquiryHref} data-cursor={cursor} data-product-inquiry>
      {children}
    </Link>
  );
}
