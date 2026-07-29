import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CarsystemHomePage } from "@/components/home/CarsystemHomePage";
import { Footer } from "@/components/layout/Footer";
import type { FinalHeroManifest } from "@/components/paint-takeover/paintTakeoverTypes";
import { jsonLd, organizationJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Carsystem i R-M | Auto lakovi, boje i oprema",
  description:
    "Profesionalni auto lakovi, boje, materijali i oprema za autolakirnice, uz tehničku podršku i partnersku mrežu u Srbiji.",
  path: "/",
  image: "/images/home/hero-dark.png",
  imageAlt: "Carsystem i R-M profesionalni refinish program",
});

export default async function Home() {
  const [paintTakeoverArtwork, paintTakeoverManifestSource] = await Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/paint-takeover-hero-strokes-final.svg",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/paint-takeover-final-manifest.json",
      ),
      "utf8",
    ),
  ]);
  const paintTakeoverManifest = JSON.parse(
    paintTakeoverManifestSource,
  ) as FinalHeroManifest;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(organizationJsonLd())}
      />
      <CarsystemHomePage
        paintTakeoverArtwork={paintTakeoverArtwork}
        paintTakeoverManifest={paintTakeoverManifest}
      />
      <Footer />
    </>
  );
}
