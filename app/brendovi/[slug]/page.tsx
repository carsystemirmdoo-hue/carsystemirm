import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BaslacBrandPage } from "@/components/baslac-brand/BaslacBrandPage";
import { BefarBrandPage } from "@/components/brand/befar/BefarBrandPage";
import { BrandPage } from "@/components/brand/BrandPage";
import { CarfitBrandPage } from "@/components/brand/carfit/CarfitBrandPage";
import { CosmosBrandPage } from "@/components/brand/cosmos/CosmosBrandPage";
import { CarsystemBrandPage } from "@/components/carsystem-brand/CarsystemBrandPage";
import { carsystemSeo } from "@/components/carsystem-brand/carsystemBrandData";
import { NorbinBrandPage } from "@/components/norbin-brand/NorbinBrandPage";
import { RmBrandPage } from "@/components/rm-brand/RmBrandPage";
import { SataBrandPage } from "@/components/brand/sata/SataBrandPage";
import { BEFAR_BRAND_SLUG } from "@/lib/befar-brand-data";
import { CARFIT_BRAND_SLUG } from "@/lib/carfit-brand-data";
import { SATA_BRAND_SLUG, sataSeo } from "@/lib/sata-brand-data";
import {
  getAllCarsystemBrands,
  getCarsystemBrandBySlug,
  getCarsystemProductsByBrandSlug,
  getPublicProgramGroupsForBrand,
  programGroups,
  refinishPhases,
  toProductListingProduct,
} from "@/lib/carsystem-data";
import { brandJsonLd, breadcrumbJsonLd, jsonLd } from "@/lib/seo";
import {
  buildBrandMetadata,
  buildPageMetadata,
} from "@/lib/seo/metadata-builders";

type BrandRouteProps = {
  params: Promise<{ slug: string }>;
};

/*
 * Ruta služi ISKLJUČIVO brendove koji su prerenderovani na buildu.
 *
 * Brendovi su statički podatak, pa nepoznat slug i ovako završava na `notFound()`. Sa
 * `dynamicParams = false` stranica se nikada ne renderuje u serverless funkciji, pa provera
 * isporučenog medija (`*Media.server.ts`, `existsSync` nad `public/`) ostaje isključivo
 * build-time korak. To je uslov pod kojim `outputFileTracingExcludes` za ovu rutu ne može da
 * promeni prikaz — vidi `next.config.ts`.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllCarsystemBrands().map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({
  params,
}: BrandRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = getCarsystemBrandBySlug(slug);
  if (!brand) return {};

  if (brand.slug === "carsystem") {
    return buildPageMetadata(carsystemSeo);
  }

  if (brand.slug === CARFIT_BRAND_SLUG) {
    return buildPageMetadata({
      title: `${brand.name} program za radionicu`,
      description:
        "Car Fit program za svakodnevni rad u lakirerskoj radionici — priprema, maskiranje, reparacija, lakiranje i završna obrada. Pronađite materijal prema poslu koji radite.",
      path: `/brendovi/${brand.slug}`,
      imageAlt: `${brand.name} program za svakodnevni rad u radionici`,
    });
  }

  if (brand.slug === SATA_BRAND_SLUG) {
    return buildPageMetadata(sataSeo);
  }

  if (brand.slug === BEFAR_BRAND_SLUG) {
    return buildPageMetadata({
      title: `${brand.name} — pene, podloške i međupodloške za poliranje`,
      description:
        "Befar program u ponudi Carsystem i R-M: pene za poliranje po tvrdoći, podloške i međupodloške sa 7, 15 i 62 otvora, brusni blokovi i hemija za korekciju i zaštitu laka.",
      path: `/brendovi/${brand.slug}`,
      imageAlt: `${brand.name} program pena, podloški i međupodloški za poliranje`,
    });
  }

  return buildBrandMetadata(brand);
}

export default async function BrandRoute({ params }: BrandRouteProps) {
  const { slug } = await params;
  const brand = getCarsystemBrandBySlug(slug);
  if (!brand) notFound();

  const products = getCarsystemProductsByBrandSlug(brand.slug).map(
    toProductListingProduct,
  );
  const publicPrograms = getPublicProgramGroupsForBrand(brand.slug);
  const allBrands = getAllCarsystemBrands();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Brendovi", path: "/brendovi" },
            { name: brand.name, path: `/brendovi/${brand.slug}` },
          ]),
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(brandJsonLd(brand))}
      />
      {brand.slug === "rm" ? (
        <RmBrandPage
          brand={brand}
          phases={refinishPhases}
          products={products}
          programs={programGroups}
        />
      ) : brand.slug === "carsystem" ? (
        <CarsystemBrandPage products={products} />
      ) : brand.slug === "baslac" ? (
        <BaslacBrandPage products={products} />
      ) : brand.slug === "norbin" ? (
        <NorbinBrandPage products={products} />
      ) : brand.slug === CARFIT_BRAND_SLUG ? (
        <CarfitBrandPage brand={brand} />
      ) : brand.slug === "cosmos-lac" ? (
        <CosmosBrandPage brand={brand} products={products} />
      ) : brand.slug === SATA_BRAND_SLUG ? (
        <SataBrandPage brand={brand} products={products} />
      ) : brand.slug === BEFAR_BRAND_SLUG ? (
        <BefarBrandPage brand={brand} products={products} />
      ) : (
        <BrandPage
          brand={brand}
          brandBySlug={new Map(allBrands.map((item) => [item.slug, item]))}
          phaseBySlug={new Map(refinishPhases.map((phase) => [phase.slug, phase]))}
          products={products}
          programBySlug={new Map(programGroups.map((program) => [program.slug, program]))}
          publicPrograms={publicPrograms}
        />
      )}
    </>
  );
}
