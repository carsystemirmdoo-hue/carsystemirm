import type { Metadata } from "next";
import { StoresPage } from "@/components/stores/StoresPage";
import { getPublicPartnerStores } from "@/lib/partner-stores";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Prodavnice i partneri",
  description:
    "Pronađite najbližu prodavnicu i partnersku mrežu za Carsystem i R-M program u Srbiji.",
  path: "/prodavnice",
});

export default function StoresRoute() {
  return <StoresPage stores={getPublicPartnerStores()} />;
}
