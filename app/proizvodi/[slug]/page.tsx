import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "@/components/product/ProductDetailPage";
import {
  getAllCarsystemProducts,
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  getManualProductRecommendations,
  getProductCompatibleProducts,
  getProgramGroupBySlug,
  getRefinishPhaseBySlug,
} from "@/lib/carsystem-data";
import { buildProductMetadata } from "@/lib/seo/metadata-builders";
import { getProductBreadcrumbItems } from "@/lib/seo/product-breadcrumbs";
import { breadcrumbJsonLd, jsonLd, productJsonLd } from "@/lib/seo";

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
  const brand = getCarsystemBrandBySlug(product.brandSlug);
  if (!brand) return {};

  return buildProductMetadata({ brand, product });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getCarsystemProductBySlug(slug);
  if (!product) notFound();

  const brand = getCarsystemBrandBySlug(product.brandSlug);
  const program = getProgramGroupBySlug(product.programSlug);
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
  if (!brand || !program || !phase) notFound();
  const breadcrumbItems = getProductBreadcrumbItems({ brand, product, program });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            ...breadcrumbItems,
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
        breadcrumbItems={breadcrumbItems}
        compatibleProducts={getProductCompatibleProducts(product)}
        similarProducts={getManualProductRecommendations(product)}
      />
    </>
  );
}
