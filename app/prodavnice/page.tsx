import type { Metadata } from "next";
import { StoresPage } from "@/components/stores/StoresPage";
import { getPublicPartnerStores } from "@/lib/partner-stores";
import {
  breadcrumbJsonLd,
  jsonLd,
  localBusinessJsonLd,
} from "@/lib/seo";
import { buildStoreMetadata } from "@/lib/seo/metadata-builders";

export const metadata: Metadata = buildStoreMetadata();

export default function StoresRoute() {
  const stores = getPublicPartnerStores();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Prodavnice", path: "/prodavnice" },
          ]),
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(localBusinessJsonLd(stores))}
      />
      <StoresPage stores={stores} />
    </>
  );
}
