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

export type ProgramCategory = {
  id: string;
  number: string;
  title: string;
  description: string;
  logos: BrandKey[];
  hints: string[];
};

export type BrandCatalogPreview = {
  brandSlug: string;
  products: CarsystemProduct[];
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
  canPreviewBrand,
  categories,
  onBrandPreview,
}: {
  activeIndex: number;
  canPreviewBrand: (brandKey: BrandKey) => boolean;
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
            canPreviewBrand={canPreviewBrand}
            isActive={isActive}
            onBrandPreview={onBrandPreview}
          />
        );
      })}
    </>
  );
}

export function BrandEcosystemMobileCards({
  activeIndex,
  canPreviewBrand,
  categories,
  onBrandPreview,
  setCardRef,
}: {
  activeIndex: number;
  canPreviewBrand: (brandKey: BrandKey) => boolean;
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
          canPreviewBrand={canPreviewBrand}
          isActive={index === activeIndex}
          onBrandPreview={onBrandPreview}
          setRef={(node) => setCardRef(index, node)}
        />
      ))}
    </>
  );
}

function ProgramCard({
  category,
  className,
  canPreviewBrand,
  isActive,
  onBrandPreview,
  setRef,
}: {
  category: ProgramCategory;
  className: string;
  canPreviewBrand: (brandKey: BrandKey) => boolean;
  isActive: boolean;
  onBrandPreview: (brandKey: BrandKey) => void;
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
              canPreview={canPreviewBrand(brandKey)}
              isActive={isActive}
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
  canPreview,
  isActive,
  onBrandPreview,
}: {
  brandKey: BrandKey;
  canPreview: boolean;
  isActive: boolean;
  onBrandPreview: (brandKey: BrandKey) => void;
}) {
  const brand = brandLogos[brandKey];

  if (!canPreview) {
    return <BrandLogoPlate brandKey={brandKey} />;
  }

  return (
    <button
      type="button"
      className={styles.programBrandLogoButton}
      disabled={!isActive}
      tabIndex={isActive ? 0 : -1}
      aria-haspopup="dialog"
      aria-label={`Pregled kataloga brenda ${brand.name}`}
      onMouseEnter={() => {
        if (isActive) onBrandPreview(brandKey);
      }}
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
  exiting,
  preview,
  onClose,
  titleId = "brand-preview-title",
  mobile = false,
}: {
  brandKey: BrandKey;
  exiting: boolean;
  preview: BrandCatalogPreview;
  onClose: () => void;
  titleId?: string;
  mobile?: boolean;
}) {
  const brand = brandLogos[brandKey];
  const brandHref = `/brendovi/${preview.brandSlug}`;

  return (
    <div
      data-brand-preview-region="panel"
      role={mobile ? undefined : "dialog"}
      aria-modal={mobile ? undefined : false}
      aria-labelledby={titleId}
      data-state={exiting ? "closing" : "open"}
      className={`${styles.programPreviewPanel} ${mobile ? styles.programPreviewPanelMobile : ""}`}
    >
      <div className={styles.programPreviewTop}>
        <span>Pregled kataloga</span>
        <button type="button" onClick={onClose} aria-label="Zatvori pregled kataloga brenda">
          &times;
        </button>
      </div>

      <div className={styles.programPreviewBody}>
        <div className={styles.programPreviewBrand}>
          <BrandLogoPlate brandKey={brandKey} />
          <div>
            <small>Program brenda</small>
            <strong>{brand.name}</strong>
          </div>
        </div>

        <h3 id={titleId}>Pregled kataloga</h3>
        <span>Proizvodi iz {brand.name} programa</span>

        <div className={styles.programPreviewGrid}>
          {preview.products.map((product) => (
            <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
              <span className={styles.programPreviewThumb}>
                {product.productImage ? (
                  <Image
                    src={product.productImage.src}
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

        <Link className={styles.programPreviewCta} href={brandHref}>
          Pogledajte katalog brenda
        </Link>
      </div>
    </div>
  );
}
