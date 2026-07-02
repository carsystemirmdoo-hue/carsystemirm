import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "@/components/product/ProductDetailPage";
import {
  getAllCarsystemProducts,
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  getProgramGroupBySlug,
  getRefinishPhaseBySlug,
  getRelatedProducts,
} from "@/lib/carsystem-data";
import { breadcrumbJsonLd, jsonLd, pageMetadata, productJsonLd } from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllCarsystemProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getCarsystemProductBySlug(slug);
  if (!product) return {};

  return pageMetadata({
    title: product.name,
    description: product.seoDescription ?? product.shortDescription,
    path: `/proizvodi/${product.slug}`,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getCarsystemProductBySlug(slug);
  if (!product) notFound();

  const brand = getCarsystemBrandBySlug(product.brandSlug);
  const program = getProgramGroupBySlug(product.programSlug);
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
  if (!brand || !program || !phase) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Katalog", path: "/katalog" },
            { name: brand.name, path: `/brendovi/${brand.slug}` },
            { name: product.name, path: `/proizvodi/${product.slug}` },
          ]),
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(productJsonLd(product, brand.name, program.name))}
      />
      <ProductDetailPage
        product={product}
        brand={brand}
        program={program}
        relatedProducts={getRelatedProducts(product)}
      />
    </>
  );
}
