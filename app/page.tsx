import type { Metadata } from "next";
import { CarsystemHomePage } from "@/components/home/CarsystemHomePage";
import { Footer } from "@/components/layout/Footer";
import { jsonLd, organizationJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Carsystem i R-M | Auto lakovi, boje i oprema",
  description:
    "Profesionalni auto lakovi, boje, materijali i oprema za autolakirnice, uz tehničku podršku i partnersku mrežu u Srbiji.",
  path: "/",
  image: "/images/home/hero-dark.png",
  imageAlt: "Carsystem i R-M profesionalni refinish program",
});

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationJsonLd())}
      />
      <CarsystemHomePage />
      <Footer />
    </>
  );
}
