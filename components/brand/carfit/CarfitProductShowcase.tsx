"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { carfitProductFilters } from "@/lib/carfit-brand-data";
import type { CarfitProductView } from "./carfit-view";
import styles from "./CarfitBrandPage.module.css";

/**
 * Prikaz Car Fit artikala koji stvarno postoje u centralnom katalogu.
 *
 * Raspored je asimetričan po dizajnu (vodeći modul + prateći), pa ostaje
 * namerno komponovan i za tri i za dvadeset artikala. Filteri se nude samo za
 * faze koje su stvarno pokrivene.
 */
export function CarfitProductShowcase({ products }: { products: CarfitProductView[] }) {
  const [activeFilter, setActiveFilter] = useState("sve");

  const availableFilters = useMemo(
    () =>
      carfitProductFilters.map((filter) => ({
        ...filter,
        count: filter.phaseSlugs
          ? products.filter((product) => filter.phaseSlugs?.includes(product.phaseSlug)).length
          : products.length,
      })),
    [products],
  );

  const visible = useMemo(() => {
    const filter = carfitProductFilters.find((item) => item.id === activeFilter);
    if (!filter?.phaseSlugs) return products;
    return products.filter((product) => filter.phaseSlugs?.includes(product.phaseSlug));
  }, [activeFilter, products]);

  if (products.length === 0) return null;

  return (
    <>
      <div className={styles.productFilters} role="group" aria-label="Filtriraj po fazi rada">
        {availableFilters.map((filter) => (
          <button
            className={styles.productFilter}
            key={filter.id}
            type="button"
            aria-pressed={activeFilter === filter.id}
            disabled={filter.count === 0}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* data-count drži raspored namernim i kada je artikala malo. */}
      <div className={styles.productShowcase} data-count={Math.min(visible.length, 3)}>
        {visible.map((product, index) => (
          <article
            className={`${styles.productCard} ${index === 0 ? styles.productCardLead : ""}`}
            key={product.slug}
          >
            <div className={styles.productMedia}>
              {product.image ? (
                <Image
                  alt={product.image.alt}
                  height={900}
                  sizes={
                    index === 0
                      ? "(min-width: 64rem) 46vw, (min-width: 48rem) 92vw, 92vw"
                      : "(min-width: 64rem) 24vw, (min-width: 48rem) 46vw, 92vw"
                  }
                  src={product.image.src}
                  width={900}
                />
              ) : (
                <div className={styles.mediaFallback} aria-hidden="true">
                  <p className={styles.mediaFallbackCode}>{product.sku}</p>
                  <p className={styles.mediaFallbackMark}>
                    C.A.R<span>.</span>FIT
                  </p>
                </div>
              )}
            </div>

            <div className={styles.productBody}>
              <p className={styles.productMeta}>
                <span>{product.programName}</span>
                <span aria-hidden="true">·</span>
                <span>{product.phaseName}</span>
              </p>

              <h3 className={styles.productName}>
                <Link href={product.href}>{product.name}</Link>
              </h3>
              <p className={styles.productPurpose}>{product.purpose}</p>

              <dl className={styles.productSpecs}>
                <div className={styles.productSpec}>
                  <dt>Šifra</dt>
                  <dd>{product.sku}</dd>
                </div>
                <div className={styles.productSpec}>
                  <dt>Pakovanje</dt>
                  <dd>{product.packageLabel}</dd>
                </div>
              </dl>

              <div className={styles.productActions}>
                <span className={styles.productStatus}>{product.status}</span>
                <Link className={styles.btnLink} href={product.href}>
                  Detalji
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
