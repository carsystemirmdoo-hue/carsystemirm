"use client";

import { useOptionalProductVariant } from "@/components/product/ProductVariantProvider";
import { customerStatusLabel, offersForView } from "./offerStatus.mjs";
import { useCustomerOffers } from "./useCustomerOffers";

/**
 * Status proizvoda koji prati izabranu varijantu i ponudu prijavljenog kupca:
 * kada kupac ispod vidi svoju cenu, natpis joj ne protivreči. Server i
 * neprijavljen posetilac dobijaju javni status (strana ostaje statična).
 */
export function CustomerStatus({ publicStatus, fallbackSlug }: { publicStatus: string; fallbackSlug: string }) {
  const data = useCustomerOffers();
  const view = useOptionalProductVariant()?.activeVariant ?? null;
  const slug = view?.slug ?? fallbackSlug;
  const keys = [view?.key, view?.id, view?.sku].filter(Boolean) as string[];
  const here = data ? offersForView(data.offers, slug, keys) : null;
  return <>{customerStatusLabel(here, Boolean(data?.ordering.enabled), publicStatus)}</>;
}
