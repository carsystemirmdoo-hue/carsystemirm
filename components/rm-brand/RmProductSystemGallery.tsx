"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RmProductImageSlot } from "@/components/rm-brand/RmProductImageSlot";
import {
  rmGallerySystems,
  type RmGallerySystemData,
  type RmProductImageSlotData,
} from "@/components/rm-brand/rmBrandData";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import styles from "./RmBrandPage.module.css";

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
  products,
}: {
  products: CarsystemProduct[];
}) {
  const [activeId, setActiveId] = useState(rmGallerySystems[0].id);
  const activeIndex = rmGallerySystems.findIndex((item) => item.id === activeId);
  const activeSystem = rmGallerySystems[Math.max(activeIndex, 0)];

  const catalogProducts = useMemo(
    () =>
      products.filter((product) => {
        if (activeSystem.kind === "system") {
          return product.rmMetadata?.system === activeSystem.id;
        }
        return product.rmMetadata?.series === activeSystem.id;
      }),
    [activeSystem, products],
  );
  const activeProducts = useMemo(
    () =>
      activeSystem.productSlugs
        ? activeSystem.productSlugs
            .map((slug) => catalogProducts.find((product) => product.slug === slug))
            .filter((product): product is CarsystemProduct => Boolean(product))
        : catalogProducts,
    [activeSystem.productSlugs, catalogProducts],
  );

  const visualItems = buildVisualItems(activeSystem, activeProducts);
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
            <p>
              <strong>{catalogProducts.length}</strong>
              <span>
                {catalogProducts.length === 1
                  ? "potvrđen artikal u javnom katalogu"
                  : "potvrđenih artikala u javnom katalogu"}
              </span>
            </p>
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
};

function buildVisualItems(
  system: RmGallerySystemData,
  products: CarsystemProduct[],
): GalleryVisualItem[] {
  const productItems = products.map((product) => ({
    group: product.rmMetadata
      ? categoryLabels[product.rmMetadata.category]
      : "R-M proizvod",
    name: product.name,
    product,
  }));
  const slotItems = system.slots
    .slice(productItems.length)
    .map((slot) => ({
      group: slot.group,
      name: slot.name,
      slot,
    }));

  return [...productItems, ...slotItems].slice(0, 5);
}

function getItemTechnology(
  item: GalleryVisualItem,
  system: RmGallerySystemData,
) {
  return (
    item.product?.rmMetadata?.technology?.replaceAll("-", " ").toUpperCase() ||
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
