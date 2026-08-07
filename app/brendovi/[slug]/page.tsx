import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BaslacBrandPage } from "@/components/baslac-brand/BaslacBrandPage";
import { BrandPage } from "@/components/brand/BrandPage";
import { CarfitBrandPage } from "@/components/brand/carfit/CarfitBrandPage";
import { CarsystemBrandPage } from "@/components/carsystem-brand/CarsystemBrandPage";
import { carsystemSeo } from "@/components/carsystem-brand/carsystemBrandData";
import { RmBrandPage } from "@/components/rm-brand/RmBrandPage";
import { CARFIT_BRAND_SLUG } from "@/lib/carfit-brand-data";
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
      ) : brand.slug === CARFIT_BRAND_SLUG ? (
        <CarfitBrandPage brand={brand} />
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
