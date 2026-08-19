import Link from "next/link";
import { RmProductImageSlot } from "@/components/rm-brand/RmProductImageSlot";
import {
  rmProductFamilies,
  type RmProductFamilyData,
  type RmProductImageSlotData,
} from "@/components/rm-brand/rmBrandData";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import styles from "./RmBrandPage.module.css";

export function RmProductFamilies({
  products,
}: {
  products: CarsystemProduct[];
}) {
  return (
    <section
      id="rm-product-families"
      className={`${styles.rmSection} ${styles.productFamilies}`}
      aria-labelledby="rm-product-families-title"
    >
      <div className={styles.productFamiliesHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.rmKicker}>Produktne porodice</p>
          <h2 id="rm-product-families-title">
            Svaka grupa ima jasno mesto u procesu.
          </h2>
        </div>
        <p>
          Potvrđene fotografije prikazujemo iz lokalnog kataloga. Nedostajući
          asseti ostaju stabilni tehnički slotovi, bez lažne ambalaže.
        </p>
      </div>

      <div className={styles.productFamilyList}>
        {rmProductFamilies.map((family) => {
          const familyProducts = family.productSlugs
            ? family.productSlugs
                .map((slug) => products.find((product) => product.slug === slug))
                .filter((product): product is CarsystemProduct => Boolean(product))
            : family.category
              ? products.filter(
                  (product) => product.rmMetadata?.category === family.category,
                )
              : [];
          const visualItems = buildFamilyVisualItems(family, familyProducts);

          return (
            <article id={`rm-family-${family.id}`} key={family.id}>
              <div className={styles.productFamilyCopy}>
                <h3>{family.label}</h3>
                <p>{family.description}</p>
                <div aria-label={`Osobine grupe ${family.label}`}>
                  {family.tags.map((tag) => (
                    <small key={tag}>{tag}</small>
                  ))}
                </div>
                <Link href={family.href}>
                  Otvorite filtrirani katalog
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>

              <div
                className={styles.productFamilyLineup}
                aria-label={`Vizuelni prikaz grupe ${family.label}`}
              >
                {visualItems.map((item, itemIndex) => (
                  <RmProductImageSlot
                    asset={item.product?.productImage}
                    altText={item.product?.productImage?.alt}
                    aspectRatio={itemIndex === 0 ? "5 / 6" : "4 / 5"}
                    feature={
                      item.product?.rmMetadata?.technology
                        ?.replaceAll("-", " ")
                        .toUpperCase() || item.slot?.technology
                    }
                    group={item.group}
                    href={
                      item.product
                        ? `/proizvodi/${item.product.slug}`
                        : family.href
                    }
                    key={`${item.name}-${itemIndex}`}
                    product={item.product}
                    productName={item.name}
                    role={`Deo grupe ${family.label}`}
                    sizes="(min-width: 70rem) 18vw, (min-width: 48rem) 28vw, 62vw"
                    system={item.system}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type FamilyVisualItem = {
  group: string;
  name: string;
  product?: CarsystemProduct;
  slot?: RmProductImageSlotData;
  system: string;
};

function buildFamilyVisualItems(
  family: RmProductFamilyData,
  products: CarsystemProduct[],
): FamilyVisualItem[] {
  const productItems: FamilyVisualItem[] = products
    .slice(0, family.visualCount)
    .map((product) => ({
    group: family.label,
    name: product.name,
    product,
    system:
      product.rmMetadata?.system?.replaceAll("-", " ").toUpperCase() || "R-M",
    }));
  const targetCount = family.visualCount;
  const remaining = Math.max(0, targetCount - productItems.length);
  const confirmedTechnologies = new Set(
    products
      .map((product) => product.rmMetadata?.technology?.toUpperCase())
      .filter(Boolean),
  );
  const preferredSlots = family.slots.filter(
      (slot) =>
        !Array.from(confirmedTechnologies).some((technology) =>
          slot.technology.includes(technology || ""),
        ),
    );
  const fallbackSlots = family.slots.filter(
    (slot) => !preferredSlots.includes(slot),
  );
  const slotItems = [...preferredSlots, ...fallbackSlots]
    .slice(0, remaining)
    .map((slot) => ({
      group: slot.group,
      name: slot.name,
      slot,
      system: family.tags[0] || "R-M",
    }));

  return [...productItems, ...slotItems];
}
