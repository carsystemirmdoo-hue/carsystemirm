import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { ProductDocuments } from "@/components/product/ProductDocuments";
import { ProductHero } from "@/components/product/ProductHero";
import { ProductMobileCta } from "@/components/product/ProductMobileCta";
import { ProductProcessPhase } from "@/components/product/ProductProcessPhase";
import { ProductSpecs } from "@/components/product/ProductSpecs";
import { ProductTrustStrip } from "@/components/product/ProductTrustStrip";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import {
  publicProgramGroups,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import styles from "./ProductDetailPage.module.css";

export function ProductDetailPage({
  product,
  brand,
  program,
  relatedProducts,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
  program: ProgramGroup;
  relatedProducts: CarsystemProduct[];
}) {
  return (
    <div className={styles.pageShell}>
      <main className={styles.pageMain}>
        <ProductBreadcrumb product={product} brand={brand} program={program} />
        <ProductHero product={product} brand={brand} program={program} />

        <section className={styles.referenceZone} aria-labelledby="product-reference-title">
          <div className={styles.referenceHeader}>
            <p className={styles.sectionKicker}>Referenca</p>
            <h2 id="product-reference-title" className={styles.referenceTitle}>
              Tehnički podaci za proveru i rad u radionici
            </h2>
            <p>
              Ovaj deo odvaja radne podatke od zone odluke: specifikacije,
              dokumentaciju, fazu procesa i povezane proizvode.
            </p>
          </div>

          <div className={styles.contentStack}>
            <ProductSpecs product={product} />
            <ProductDocuments product={product} />
            <ProductProcessPhase product={product} />
          </div>

          <RelatedProducts products={relatedProducts} />
          <ProductTrustStrip />
        </section>
      </main>
      <Footer />
      <ProductMobileCta product={product} />
    </div>
  );
}

function ProductBreadcrumb({
  product,
  brand,
  program,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
  program: ProgramGroup;
}) {
  const publicProgram = publicProgramGroups.find((item) =>
    item.internalProgramSlugs.includes(program.slug),
  );
  const items = [
    { href: "/", label: "Početna" },
    { href: "/katalog", label: "Katalog" },
    {
      href: `/program/${publicProgram?.slug ?? program.slug}`,
      label: publicProgram?.name ?? program.name,
    },
    { href: `/brendovi/${brand.slug}`, label: brand.name },
  ];

  return (
    <nav className={styles.breadcrumb} aria-label="Putanja">
      <ol>
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href}>{item.label}</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
          </li>
        ))}
        <li className={styles.breadcrumbCurrent} aria-current="page">
          {product.name}
        </li>
      </ol>
    </nav>
  );
}
