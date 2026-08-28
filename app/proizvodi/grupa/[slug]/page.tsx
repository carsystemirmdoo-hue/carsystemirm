import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogStaticProductGrid } from "@/components/catalog/CatalogSeoContent";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import {
  getAllCarsystemBrands,
  getCarsystemBrandBySlug,
  getManualProductRecommendations,
  getProductCompatibleProducts,
  getProgramGroupBySlug,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import { toCatalogListingEntity } from "@/lib/catalog-listing";
import {
  getAllProductFamilies,
  getProductFamilyBySlug,
} from "@/lib/product-families";
import {
  breadcrumbJsonLd,
  jsonLd,
  productGroupJsonLd,
} from "@/lib/seo";
import { buildProductFamilyMetadata } from "@/lib/seo/metadata-builders";
import { BaslacSystemPdp } from "@/components/baslac-brand/BaslacSystemPdp";
import { ProductDetailPage } from "@/components/product/ProductDetailPage";
import { baslacSystemFamilies } from "@/lib/baslac-catalog-products";
import styles from "@/components/catalog/CatalogPage.module.css";

type FamilyRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllProductFamilies().map((family) => ({ slug: family.slug }));
}

export async function generateMetadata({
  params,
}: FamilyRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const family = getProductFamilyBySlug(slug);
  return family ? buildProductFamilyMetadata(family) : {};
}

export default async function ProductFamilyRoute({ params }: FamilyRouteProps) {
  const { slug } = await params;
  const family = getProductFamilyBySlug(slug);
  if (!family) notFound();

  const brand = getCarsystemBrandBySlug(family.brandSlug);
  const baslacSystem = baslacSystemFamilies.find(
    (entry) => entry.baseProductSlug === family.slug,
  );
  const products = family.variants.map(toCatalogListingEntity);
  const route = `/proizvodi/grupa/${family.slug}`;
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Katalog", path: "/katalog" },
    ...(brand ? [{ name: brand.name, path: brand.routes.landing }] : []),
    { name: family.name, path: route },
  ];

  const variationLabel = family.variesBy.includes("color")
    ? "nijansi i varijanti"
    : "varijanti";

  // `variant-pdp` porodice SU proizvod. Generički group hero, CTA kartica i
  // mreža kartica se za njih uopšte ne renderuju — ne skrivaju se CSS-om.
  if (family.presentation === "variant-pdp") {
    if (baslacSystem) {
      return (
        <div className={styles.catalogShell}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLd(productGroupJsonLd(family))}
          />
          <main className={styles.main}>
            <SeoBreadcrumbs items={breadcrumbs} />
            <BaslacSystemPdp
              familyName={family.name}
              intro={baslacSystem.intro}
              system={baslacSystem.system}
              systemName={baslacSystem.name}
            />
          </main>
          <Footer />
        </div>
      );
    }

    // Ostale variant porodice koriste postojeći product-detail sloj.
    const representative = family.representative;
    const productBrand = getCarsystemBrandBySlug(representative.brandSlug);
    const productProgram = getProgramGroupBySlug(representative.programSlug);
    if (!productBrand || !productProgram) notFound();
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(productGroupJsonLd(family))}
        />
        <ProductDetailPage
          brand={productBrand}
          breadcrumbItems={breadcrumbs}
          compatibleProducts={getProductCompatibleProducts(representative)}
          product={representative}
          variantSelectInPlace
          program={productProgram}
          similarProducts={getManualProductRecommendations(representative)}
        />
      </>
    );
  }

  return (
    <div className={styles.catalogShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(productGroupJsonLd(family))}
      />
      <main className={styles.main}>
        <SeoBreadcrumbs items={breadcrumbs} />
        <section className={styles.hero} aria-labelledby="family-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Grupa proizvoda</p>
            <h1 id="family-title" className={styles.title}>
              {family.name}
            </h1>
            <p className={styles.subtitle}>
              {baslacSystem
                ? `${family.variants.length} dostupnih baza. Izaberite bazu desno, podesite količinu i dodajte je u listu za upit.`
                : `${family.variants.length} ${variationLabel} unutar iste grupe proizvoda. Sve varijante dele istu namenu, a razlikuju se po ${family.variesBy.includes("color") ? "nijansi" : "izvedbi"} i oznaci.`}
            </p>
          </div>
          <div className={styles.heroTools}>
            <p className={styles.searchLabel}>
              {family.line ? `Linija ${family.line}` : "Grupa proizvoda"}
            </p>
            <p className={styles.subtitle}>
              Dostupnost i izbor konkretne varijante potvrđuju se kroz upit.
            </p>
            {brand ? (
              <Link className={styles.primaryButton} href={brand.routes.landing}>
                Otvorite {brand.name} program
              </Link>
            ) : null}
          </div>
        </section>
        {baslacSystem ? (
          // Baslac sistemi su pravi PDP odmah — bez međukoraka i bez
          // ponovnog biranja istog sistema.
          <BaslacSystemPdp
            familyName={family.name}
            intro={baslacSystem.intro}
            system={baslacSystem.system}
            systemName={baslacSystem.name}
          />
        ) : (
          <CatalogStaticProductGrid
            brands={getAllCarsystemBrands()}
            phases={refinishPhases}
            entities={products}
            programs={programGroups}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
