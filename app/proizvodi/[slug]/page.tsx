import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
import {
  breadcrumbJsonLd,
  jsonLd,
  productJsonLd,
  productRelationshipJsonLd,
} from "@/lib/seo";
import {
  familyPath,
  getFamilyForProduct,
  variantRedirectTarget,
} from "@/lib/product-families";


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

  // Variants of a multi-variant family canonicalise to the family page so the
  // 715 near-duplicate colour pages consolidate onto 41 real entities.
  const family = getFamilyForProduct(product);

  return buildProductMetadata({
    brand,
    product,
    canonicalPath: family ? familyPath(family) : undefined,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  {
    // Baslac sistemske baze nemaju sopstvenu stranicu — vode na family PDP sa
    // već izabranom varijantom, bez međukoraka.
    const { slug: requestedSlug } = await params;
    const requested = getCarsystemProductBySlug(requestedSlug);
    const target = requested ? variantRedirectTarget(requested) : null;
    if (target) redirect(target);
  }
  const { slug } = await params;
  const product = getCarsystemProductBySlug(slug);
  if (!product) notFound();

  const brand = getCarsystemBrandBySlug(product.brandSlug);
  const program = getProgramGroupBySlug(product.programSlug);
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
  if (!brand || !program || !phase) notFound();
  const breadcrumbItems = getProductBreadcrumbItems({ brand, product, program });
  const family = getFamilyForProduct(product);
  const compatibleProducts = getProductCompatibleProducts(product);
  const similarProducts = getManualProductRecommendations(product);

  // Only documents that are actually available and linked on the page.
  const availableDocuments = product.documents
    .filter((document) => document.status === "available" && document.href)
    .map((document) => ({ title: document.title, href: document.href! }));

  const relationshipNode = productRelationshipJsonLd({
    product,
    compatibleProducts,
    similarProducts,
    documents: availableDocuments,
  });

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
        dangerouslySetInnerHTML={jsonLd(
          productJsonLd(product, brand.name, program.name, family),
        )}
      />
      {relationshipNode ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(relationshipNode)}
        />
      ) : null}
      <ProductDetailPage
        product={product}
        brand={brand}
        program={program}
        breadcrumbItems={breadcrumbItems}
        compatibleProducts={compatibleProducts}
        similarProducts={similarProducts}
      />
    </>
  );
}
