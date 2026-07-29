import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BaslacBrandPage } from "@/components/baslac-brand/BaslacBrandPage";
import { BrandPage } from "@/components/brand/BrandPage";
import { RmBrandPage } from "@/components/rm-brand/RmBrandPage";
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
import { buildBrandMetadata } from "@/lib/seo/metadata-builders";

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
      ) : brand.slug === "baslac" ? (
        <BaslacBrandPage products={products} />
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
