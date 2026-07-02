import type { Metadata } from "next";
import { CarsystemHomePage } from "@/components/home/CarsystemHomePage";
import { jsonLd, organizationJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Carsystem i R-M Inđija | Profesionalni refinish program",
  description:
    "Profesionalni program za pripremu, farbanje, opremu i završnu obradu vozila kroz mrežu partnera u Srbiji.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationJsonLd())}
      />
      <CarsystemHomePage />
    </>
  );
}
