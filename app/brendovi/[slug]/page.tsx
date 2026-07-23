import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandPage } from "@/components/brand/BrandPage";
import {
  getAllCarsystemBrands,
  getCarsystemBrandBySlug,
  getCarsystemProductsByBrandSlug,
  getPublicProgramGroupsForBrand,
  programGroups,
  refinishPhases,
  toProductListingProduct,
} from "@/lib/carsystem-data";
import { brandJsonLd, breadcrumbJsonLd, jsonLd, pageMetadata } from "@/lib/seo";

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

  return pageMetadata({
    title: `${brand.name} program | Carsystem i R-M Inđija`,
    description: brand.description,
    path: `/brendovi/${brand.slug}`,
  });
}

export default async function BrandRoute({ params }: BrandRouteProps) {
  const { slug } = await params;
  const brand = getCarsystemBrandBySlug(slug);
  if (!brand) notFound();

  const products = getCarsystemProductsByBrandSlug(brand.slug).map(
    toProductListingProduct,
  );
  const publicPrograms = getPublicProgramGroupsForBrand(brand.slug);

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
      <BrandPage
        brand={brand}
        brandBySlug={new Map(getAllCarsystemBrands().map((item) => [item.slug, item]))}
        phaseBySlug={new Map(refinishPhases.map((phase) => [phase.slug, phase]))}
        products={products}
        programBySlug={new Map(programGroups.map((program) => [program.slug, program]))}
        publicPrograms={publicPrograms}
      />
    </>
  );
}
