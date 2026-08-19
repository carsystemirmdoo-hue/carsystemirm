import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogStaticProductGrid } from "@/components/catalog/CatalogSeoContent";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import {
  getAllCarsystemBrands,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import { toCatalogListingEntity } from "@/lib/catalog-listing";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLd,
} from "@/lib/seo";
import {
  getSeoCategoryLanding,
  getSeoCategoryProducts,
  seoCategoryLandings,
} from "@/lib/seo/category-landings";
import { buildCategoryMetadata } from "@/lib/seo/metadata-builders";
import styles from "@/components/catalog/CatalogPage.module.css";

type CategoryRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return seoCategoryLandings.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: CategoryRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getSeoCategoryLanding(slug);
  return category ? buildCategoryMetadata(category) : {};
}

export default async function CategoryRoute({ params }: CategoryRouteProps) {
  const { slug } = await params;
  const category = getSeoCategoryLanding(slug);
  if (!category) notFound();

  const products = getSeoCategoryProducts(category).map(toCatalogListingEntity);
  const route = `/kategorije/${category.slug}`;
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Katalog", path: "/katalog" },
    { name: category.name, path: route },
  ];

  return (
    <div className={styles.catalogShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionPageJsonLd({
            name: category.title,
            description: category.description,
            path: route,
            itemUrls: products.map((product) => product.href),
          }),
        )}
      />
      <main className={styles.main}>
        <SeoBreadcrumbs items={breadcrumbs} />
        <section className={styles.hero} aria-labelledby="category-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Kategorija proizvoda</p>
            <h1 id="category-title" className={styles.title}>
              {category.name}
            </h1>
            <p className={styles.subtitle}>{category.intro}</p>
          </div>
          <div className={styles.heroTools}>
            <p className={styles.searchLabel}>Potvrđeni R-M proizvodi</p>
            <p className={styles.subtitle}>
              {products.length} proizvoda sa direktnim linkovima ka nameni,
              dokumentaciji i upitu za dostupnost.
            </p>
            <Link className={styles.primaryButton} href="/brendovi/rm">
              Otvorite R-M program
            </Link>
          </div>
        </section>
        <CatalogStaticProductGrid
          brands={getAllCarsystemBrands()}
          phases={refinishPhases}
          entities={products}
          programs={programGroups}
        />
      </main>
      <Footer />
    </div>
  );
}
