"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import {
  carsystemCatalogHref,
  carsystemProductFilters,
  carsystemProductOrder,
  carsystemRangeCategories,
} from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

type ProductFilterId = (typeof carsystemProductFilters)[number]["id"];

export function CarsystemProducts({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const [activeFilter, setActiveFilter] = useState<ProductFilterId>("all");
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const selectedFilter =
    carsystemProductFilters.find((filter) => filter.id === activeFilter) ??
    carsystemProductFilters[0];
  const visibleSlugs =
    activeFilter === "all"
      ? carsystemProductOrder
      : selectedFilter.productSlugs;
  const visibleProducts = visibleSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is CarsystemProduct => Boolean(product))
    .slice(0, 12);

  return (
    <section
      id="products"
      className={`${styles.section} ${styles.productsSection}`}
      aria-labelledby="carsystem-products-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Lokalni javni katalog</p>
          <h2 id="carsystem-products-title">
            Carsystem proizvodi dostupni kod nas
          </h2>
        </div>
        <p>
          Prikaz koristi postojeće javne product zapise. Cene i stanje nisu
          javni i proveravaju se kroz upit.
        </p>
      </header>

      <div className={styles.rangeCoverage}>
        <p>Carsystem asortiman pokriva</p>
        <ul>
          {carsystemRangeCategories.map((category) => (
            <li key={category}>
              <Link href={carsystemCatalogHref()}>{category}</Link>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={styles.productFilters}
        role="group"
        aria-label="Filtrirajte Carsystem proizvode"
      >
        {carsystemProductFilters.map((filter) => (
          <button
            type="button"
            aria-pressed={activeFilter === filter.id}
            data-active={activeFilter === filter.id || undefined}
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Prikazano {visibleProducts.length} Carsystem proizvoda
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
          Potreban Vam je artikal koji još nema javnu fotografiju? Pošaljite
          naziv ili šifru i proverićemo odgovarajući zapis.
        </p>
        <Link className={styles.primaryButton} href={carsystemCatalogHref()}>
          Pogledajte sve Carsystem proizvode
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function ProductCard({
  index,
  product,
}: {
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
          <span>{product.programSlug.replaceAll("-", " ")}</span>
          <h3>{product.name}</h3>
          <p>{product.shortDescription}</p>
          <strong>
            Otvorite proizvod
            <i aria-hidden="true">↗</i>
          </strong>
        </span>
      </Link>
    </article>
  );
}
