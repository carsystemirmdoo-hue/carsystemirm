"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BrandLogoPlate,
  brandLogos,
  type BrandKey,
} from "@/components/home/BrandLogoPlate";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import styles from "../CarsystemHomePage.module.css";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";

export type ProgramCategory = {
  id: string;
  number: string;
  title: string;
  description: string;
  logos: BrandKey[];
  hints: string[];
};

export type BrandCatalogPreview = {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  products: CarsystemProduct[];
  title: string;
};

function getCircularPosition(index: number, activeIndex: number, count: number) {
  const raw = (index - activeIndex + count) % count;

  return raw > count / 2 ? raw - count : raw;
}

function getPositionClass(position: number) {
  if (position === 0) return styles.programDeckCardActive;
  if (position === -1) return styles.programDeckCardPrevious;
  if (position === 1) return styles.programDeckCardNext;
  if (position === -2) return styles.programDeckCardFarPrevious;
  return styles.programDeckCardFarNext;
}

export function BrandEcosystemDesktopCards({
  activeIndex,
  activePreviewBrandKey,
  categories,
  onBrandPreview,
}: {
  activeIndex: number;
  activePreviewBrandKey: BrandKey | null;
  categories: ProgramCategory[];
  onBrandPreview: (brandKey: BrandKey) => void;
}) {
  return (
    <>
      {categories.map((category, index) => {
        const position = getCircularPosition(index, activeIndex, categories.length);
        const isActive = position === 0;

        return (
          <ProgramCard
            key={category.id}
            category={category}
            className={getPositionClass(position)}
            isActive={isActive}
            onBrandPreview={onBrandPreview}
            selectedBrandKey={isActive ? activePreviewBrandKey : null}
          />
        );
      })}
    </>
  );
}

export function BrandEcosystemMobileCards({
  activeIndex,
  activePreviewBrandKey,
  categories,
  onBrandPreview,
  setCardRef,
}: {
  activeIndex: number;
  activePreviewBrandKey: BrandKey | null;
  categories: ProgramCategory[];
  onBrandPreview: (brandKey: BrandKey) => void;
  setCardRef: (index: number, node: HTMLElement | null) => void;
}) {
  return (
    <>
      {categories.map((category, index) => (
        <ProgramCard
          key={category.id}
          category={category}
          className={index === activeIndex ? styles.programMobileCardActive : ""}
          isActive={index === activeIndex}
          onBrandPreview={onBrandPreview}
          selectedBrandKey={index === activeIndex ? activePreviewBrandKey : null}
          setRef={(node) => setCardRef(index, node)}
        />
      ))}
    </>
  );
}

function ProgramCard({
  category,
  className,
  isActive,
  onBrandPreview,
  selectedBrandKey,
  setRef,
}: {
  category: ProgramCategory;
  className: string;
  isActive: boolean;
  onBrandPreview: (brandKey: BrandKey) => void;
  selectedBrandKey: BrandKey | null;
  setRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={setRef}
      data-brand-preview-region={isActive ? "card" : undefined}
      className={`${styles.programDeckCard} ${className}`}
      aria-current={isActive ? "step" : undefined}
    >
      <div className={styles.programCardInner}>
        <div className={styles.programCardTop}>
          <span className={styles.programNumber}>{category.number}</span>
          <span className={styles.programCardLabel}>Program</span>
        </div>

        <div className={styles.programCardBody}>
          <h3>{category.title}</h3>
          <p>{category.description}</p>
        </div>

        <div className={styles.programLogoGrid} aria-label={`Brendovi za ${category.title}`}>
          {category.logos.map((brandKey) => (
            <ProgramBrandLogo
              key={brandKey}
              brandKey={brandKey}
              isActive={isActive}
              isSelected={isActive && selectedBrandKey === brandKey}
              onBrandPreview={onBrandPreview}
            />
          ))}
        </div>

        <div className={styles.programHints} aria-label="Program obuhvata">
          {category.hints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>

        <a
          className={styles.programPreviewButton}
          href={`/program/${category.id}`}
          tabIndex={isActive ? 0 : -1}
        >
          Pogledajte program
        </a>
      </div>
    </article>
  );
}

function ProgramBrandLogo({
  brandKey,
  isActive,
  isSelected,
  onBrandPreview,
}: {
  brandKey: BrandKey;
  isActive: boolean;
  isSelected: boolean;
  onBrandPreview: (brandKey: BrandKey) => void;
}) {
  const brand = brandLogos[brandKey];

  return (
    <button
      type="button"
      className={styles.programBrandLogoButton}
      disabled={!isActive}
      tabIndex={isActive ? 0 : -1}
      aria-pressed={isSelected}
      aria-label={`Prikažite proizvode brenda ${brand.name}`}
      data-selected={isSelected || undefined}
      onPointerEnter={(event) => {
        if (isActive && event.pointerType !== "touch") onBrandPreview(brandKey);
      }}
      onFocus={() => {
        if (isActive) onBrandPreview(brandKey);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (isActive) onBrandPreview(brandKey);
      }}
    >
      <BrandLogoPlate brandKey={brandKey} />
    </button>
  );
}

export function BrandPreviewPanel({
  brandKey,
  preview,
  titleId = "brand-preview-title",
}: {
  brandKey: BrandKey;
  preview: BrandCatalogPreview;
  titleId?: string;
}) {
  const brand = brandLogos[brandKey];

  return (
    <div
      data-brand-preview-region="panel"
      role="region"
      aria-labelledby={titleId}
      className={`${styles.programPreviewPanel} ${styles.programPreviewPanelInline}`}
    >
      <div className={styles.programPreviewTop}>
        <span>Aktivni pregled</span>
      </div>

      <div className={styles.programPreviewBody}>
        <div className={styles.programPreviewBrand}>
          <BrandLogoPlate brandKey={brandKey} />
          <div>
            <small>Program brenda</small>
            <strong>{brand.name}</strong>
          </div>
        </div>

        <h3 id={titleId}>{preview.title}</h3>
        <span>{preview.description}</span>

        <div className={styles.programPreviewGrid}>
          {preview.products.map((product) => (
            <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
              <span className={styles.programPreviewThumb}>
                {product.productImage ? (
                  <Image
                    src={toDisplayImageSrc(product.productImage.src)}
                    alt={product.productImage.alt}
                    width={96}
                    height={72}
                  />
                ) : (
                  <span className={styles.programPreviewPlaceholder}>Slika u pripremi</span>
                )}
              </span>
              <small>{product.badges[0] ?? product.sku}</small>
              <strong>{product.name}</strong>
            </Link>
          ))}
        </div>

        <Link
          className={`${styles.programPreviewCta} cs-magnetic-cta cs-theme-wipe-card`}
          data-cursor="button"
          data-motion="theme-wipe"
          data-motion-surface
          href={preview.ctaHref}
        >
          <span>{preview.ctaLabel}</span>
        </Link>
      </div>
    </div>
  );
}
