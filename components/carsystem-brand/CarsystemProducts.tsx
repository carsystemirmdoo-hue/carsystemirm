"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import {
  carsystemCatalogHref,
  carsystemProductOrder,
  carsystemRangeFilters,
} from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";
import { programLabel } from "./programLabel";

type ProductFilterId = "all" | (typeof carsystemRangeFilters)[number]["id"];

const VISIBLE_LIMIT = 12;

export function CarsystemProducts({
  products,
  officialCategoryBySlug,
}: {
  products: CarsystemProduct[];
  /** Zvanična carsystem.org kategorija po slug-u (server, lib/carsystem-catalog-products). */
  officialCategoryBySlug: Record<string, string>;
}) {
  const [activeFilter, setActiveFilter] = useState<ProductFilterId>("all");
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const productsByFilter = useMemo(() => {
    const groups = new Map<ProductFilterId, CarsystemProduct[]>();
    const curated = carsystemProductOrder
      .map((slug) => productBySlug.get(slug))
      .filter((product): product is CarsystemProduct => Boolean(product));
    groups.set("all", curated);
    for (const filter of carsystemRangeFilters) {
      const inCategory = products.filter(
        (product) => officialCategoryBySlug[product.slug] === filter.officialCategory,
      );
      // Prvo artikli iz kuriranog izbora (imaju proverenu sliku i opis), zatim ostali redom kataloga.
      inCategory.sort(
        (a, b) => rank(a.slug) - rank(b.slug),
      );
      groups.set(filter.id, inCategory);
    }
    return groups;
  }, [officialCategoryBySlug, productBySlug, products]);

  const filters = [
    { id: "all" as const, label: "Svi", count: products.length },
    ...carsystemRangeFilters.map((filter) => ({
      id: filter.id,
      label: filter.label,
      count: productsByFilter.get(filter.id)?.length ?? 0,
    })),
  ].filter((filter) => filter.id === "all" || filter.count > 0);

  const selected = productsByFilter.get(activeFilter) ?? [];
  const visibleProducts = selected.slice(0, VISIBLE_LIMIT);
  const activeLabel = filters.find((filter) => filter.id === activeFilter)?.label ?? "Svi";

  return (
    <section
      id="products"
      className={`${styles.section} ${styles.productsSection}`}
      aria-labelledby="carsystem-products-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Katalog</p>
          <h2 id="carsystem-products-title">
            Carsystem proizvodi dostupni kod nas
          </h2>
        </div>
        <p>
          Cene i stanje na lageru nisu javni — proveravaju se kroz upit.
        </p>
      </header>

      <div className={styles.rangeFilters}>
        <p id="carsystem-range-label">Carsystem asortiman pokriva</p>
        <div
          className={styles.productFilters}
          role="group"
          aria-labelledby="carsystem-range-label"
        >
          {filters.map((filter) => (
            <button
              type="button"
              aria-pressed={activeFilter === filter.id}
              data-active={activeFilter === filter.id || undefined}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
              {filter.id !== "all" ? (
                <span className={styles.filterCount} aria-label={`${filter.count} artikala`}>
                  {filter.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.filterSummary} role="status" aria-live="polite">
        {activeFilter === "all"
          ? `Izbor ${visibleProducts.length} Carsystem proizvoda`
          : `${activeLabel}: prikazano ${visibleProducts.length} od ${selected.length}`}
      </p>

      <div className={styles.productGrid} key={activeFilter}>
        {visibleProducts.map((product, index) => (
          <ProductCard
            index={String(index + 1).padStart(2, "0")}
            key={product.slug}
            product={product}
          />
        ))}
      </div>

      <div className={styles.productsFooter}>
        <p>
          Ne vidite artikal koji Vam treba? Pošaljite naziv ili šifru i
          proverićemo dostupnost.
        </p>
        <Link className={`${styles.primaryButton} cs-cta`} data-cta-on="theme" href={carsystemCatalogHref()}>
          Pogledajte sve Carsystem proizvode
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

const curatedRank = new Map<string, number>(
  carsystemProductOrder.map((slug, index) => [slug, index]),
);

function rank(slug: string) {
  return curatedRank.get(slug) ?? carsystemProductOrder.length;
}

export function ProductCard({
  eyebrow,
  index,
  product,
}: {
  /** Oznaka iznad naziva; podrazumevano naziv programa. */
  eyebrow?: string;
  index: string;
  product: CarsystemProduct;
}) {
  const image = product.productImage ?? product.galleryImages[0] ?? null;
  const usesPlaceholder = image?.src.includes("placeholder-product");

  return (
    <article className={styles.productCard}>
      <Link href={`/proizvodi/${product.slug}`}>
        <span
          className={styles.productCardVisual}
          data-placeholder={usesPlaceholder || !image || undefined}
        >
          {image && !usesPlaceholder ? (
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 80rem) 24vw, (min-width: 48rem) 42vw, 88vw"
            />
          ) : (
            <span className={styles.productFallback} aria-hidden="true">
              <Image
                src="/brands/carsystem.svg"
                alt=""
                width={112}
                height={48}
              />
            </span>
          )}
          <small>{index}</small>
        </span>

        <span className={styles.productCardCopy}>
          <span>{eyebrow ?? programLabel(product.programSlug)}</span>
          <h3>{product.name}</h3>
          <p>{product.shortDescription}</p>
          <strong>
            Otvorite proizvod
            <i aria-hidden="true">→</i>
          </strong>
        </span>
      </Link>
    </article>
  );
}
