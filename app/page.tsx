import type { Metadata } from "next";
import { CarsystemHomePage } from "@/components/home/CarsystemHomePage";
import { Footer } from "@/components/layout/Footer";
import { jsonLd, organizationJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Carsystem i R-M Inđija | Profesionalni refinish program",
  description:
    "Distribucija profesionalnih refinish materijala, boja, lakova, opreme i tehničke podrške kroz partnersku mrežu u Srbiji.",
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
      <Footer />
    </>
  );
}
