"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RmProductImageSlot } from "@/components/rm-brand/RmProductImageSlot";
import {
  rmGallerySystems,
  type RmGallerySystemData,
  type RmProductImageSlotData,
} from "@/components/rm-brand/rmBrandData";
import { selectRmGroupProducts } from "@/components/rm-brand/rmBrandSelection";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import type { RmBrandClassifications } from "@/lib/rm-brand-classification";
import styles from "./RmBrandPage.module.css";

/** Centralni proizvod + četiri pomoćna. */
const GALLERY_VISUAL_COUNT = 5;

const categoryLabels = {
  additive: "Aditiv",
  basecoat: "Bazna boja",
  bodyfiller: "Kit",
  cleaner: "Čistač",
  clearcoat: "Bezbojni lak",
  hardener: "Učvršćivač",
  "polishing-compound": "Pasta za poliranje",
  "primer-filler": "Prajmer ili punilac",
  thinner: "Razređivač",
} as const;

export function RmProductSystemGallery({
  classifications,
  products,
}: {
  classifications: RmBrandClassifications;
  products: CarsystemProduct[];
}) {
  const [activeId, setActiveId] = useState(rmGallerySystems[0].id);
  const activeIndex = rmGallerySystems.findIndex((item) => item.id === activeId);
  const activeSystem = rmGallerySystems[Math.max(activeIndex, 0)];

  const catalogProducts = useMemo(
    () =>
      products.filter((product) => {
        if (activeSystem.kind === "system") {
          return classifications[product.slug]?.system === activeSystem.id;
        }
        return classifications[product.slug]?.series === activeSystem.id;
      }),
    [activeSystem, classifications, products],
  );
  const activeProducts = useMemo(
    () =>
      selectRmGroupProducts({
        limit: GALLERY_VISUAL_COUNT,
        members: catalogProducts,
        pinnedSlugs: activeSystem.productSlugs,
      }),
    [activeSystem.productSlugs, catalogProducts],
  );

  const visualItems = buildVisualItems(activeSystem, activeProducts, classifications);
  const centralItem = visualItems[0];
  const supportingItems = visualItems.slice(1, 5);

  return (
    <section
      id="rm-system-gallery"
      className={`${styles.rmSection} ${styles.systemGallery}`}
      aria-labelledby="rm-system-gallery-title"
    >
      <div className={styles.systemGalleryIntro}>
        <div className={styles.sectionHeading}>
          <p className={styles.rmKicker}>R-M Product System Gallery</p>
          <h2 id="rm-system-gallery-title">
            Proizvod ima smisla tek unutar sistema.
          </h2>
        </div>
        <p>
          Izaberite liniju ili seriju da vidite centralni proizvod, pomoćne
          procesne grupe i njihovo mesto u kompletnom toku.
        </p>
      </div>

      <div className={styles.systemGalleryLayout}>
        <div
          className={styles.systemGalleryTabs}
          role="tablist"
          aria-label="Izaberite R-M sistem ili seriju"
        >
          {rmGallerySystems.map((system, index) => (
            <button
              type="button"
              role="tab"
              id={`rm-system-tab-${system.id}`}
              aria-controls="rm-system-gallery-panel"
              aria-selected={system.id === activeSystem.id}
              data-active={system.id === activeSystem.id || undefined}
              key={system.id}
              onClick={() => setActiveId(system.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{system.label}</strong>
              <small>{system.technology}</small>
            </button>
          ))}
        </div>

        <div
          id="rm-system-gallery-panel"
          className={styles.systemGalleryPanel}
          role="tabpanel"
          aria-labelledby={`rm-system-tab-${activeSystem.id}`}
          key={activeSystem.id}
        >
          <header className={styles.systemGalleryPanelHeader}>
            <div>
              <p>{activeSystem.eyebrow}</p>
              <h3>{activeSystem.label}</h3>
            </div>
            <p>{activeSystem.description}</p>
          </header>

          <div className={styles.systemGalleryComposition}>
            <article className={styles.systemGalleryHeroProduct}>
              <RmProductImageSlot
                asset={centralItem.product?.productImage}
                altText={centralItem.product?.productImage?.alt}
                aspectRatio="5 / 6"
                feature={getItemTechnology(centralItem, activeSystem)}
                group={centralItem.group}
                href={getItemHref(centralItem, activeSystem)}
                priority
                product={centralItem.product}
                productName={centralItem.name}
                role={centralItem.group}
                system={activeSystem.label}
              />
            </article>

            <div
              className={styles.systemGallerySupporting}
              aria-label={`Pomoćne grupe za ${activeSystem.label}`}
            >
              {supportingItems.map((item, index) => (
                <article key={`${item.name}-${index}`}>
                  <RmProductImageSlot
                    asset={item.product?.productImage}
                    altText={item.product?.productImage?.alt}
                    aspectRatio="4 / 5"
                    feature={getItemTechnology(item, activeSystem)}
                    group={item.group}
                    href={getItemHref(item, activeSystem)}
                    product={item.product}
                    productName={item.name}
                    role={item.group}
                    sizes="(min-width: 70rem) 12vw, (min-width: 48rem) 22vw, 54vw"
                    system={activeSystem.label}
                  />
                </article>
              ))}
            </div>
          </div>

          <footer className={styles.systemGalleryFooter}>
            <div>
              <Link
                className={styles.rmOutlineButton}
                href={activeSystem.catalogHref}
              >
                Filtrirani katalog
                <span aria-hidden="true">↗</span>
              </Link>
              <Link
                className={styles.rmPrimaryButton}
                href={activeSystem.inquiryHref}
              >
                Pošaljite upit
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}

type GalleryVisualItem = {
  group: string;
  name: string;
  product?: CarsystemProduct;
  slot?: RmProductImageSlotData;
  technology?: string | null;
};

function buildVisualItems(
  system: RmGallerySystemData,
  products: CarsystemProduct[],
  classifications: RmBrandClassifications,
): GalleryVisualItem[] {
  const productItems = products.map((product) => {
    const classification = classifications[product.slug];
    return {
      group: classification
        ? (classification.categoryLabel ?? categoryLabels[classification.category])
        : "R-M proizvod",
      name: product.name,
      product,
      technology: classification?.technology ?? null,
    };
  });
  const slotItems = system.slots
    .slice(productItems.length)
    .map((slot) => ({
      group: slot.group,
      name: slot.name,
      slot,
    }));

  return [...productItems, ...slotItems].slice(0, GALLERY_VISUAL_COUNT);
}

function getItemTechnology(
  item: GalleryVisualItem,
  system: RmGallerySystemData,
) {
  return (
    item.technology?.replaceAll("-", " ").toUpperCase() ||
    item.slot?.technology ||
    system.technology
  );
}

function getItemHref(
  item: GalleryVisualItem,
  system: RmGallerySystemData,
) {
  return item.product
    ? `/proizvodi/${item.product.slug}`
    : system.catalogHref;
}
