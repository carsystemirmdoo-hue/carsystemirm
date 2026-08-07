"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { CarsystemMediaSlot } from "./CarsystemMediaSlot";
import {
  carsystemMedia,
  carsystemProcessPhases,
  type CarsystemMediaAvailability,
  type CarsystemProcessPhase,
} from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

export function CarsystemProcess({
  availability,
  products,
}: {
  availability: CarsystemMediaAvailability;
  products: CarsystemProduct[];
}) {
  const [activeId, setActiveId] = useState<CarsystemProcessPhase["id"]>(
    carsystemProcessPhases[0].id,
  );
  const idPrefix = useId();
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const activePhase =
    carsystemProcessPhases.find((phase) => phase.id === activeId) ??
    carsystemProcessPhases[0];
  const activeProducts = activePhase.productSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is CarsystemProduct => Boolean(product));
  const activeMedia = carsystemMedia[activePhase.mediaId];

  return (
    <section
      id="process"
      className={`${styles.section} ${styles.processSection}`}
      aria-labelledby="carsystem-process-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Centralni radni tok</p>
          <h2 id="carsystem-process-title">Jedan sistem kroz ceo proces</h2>
        </div>
        <p>
          Od pripreme površine do završne kontrole, svaki korak je povezan sa
          sledećim.
        </p>
      </header>

      <div className={styles.processDesktop}>
        <div
          className={styles.processTabs}
          role="tablist"
          aria-label="Faze Carsystem procesa"
          aria-orientation="vertical"
        >
          {carsystemProcessPhases.map((phase) => (
            <button
              type="button"
              id={`${idPrefix}-${phase.id}-tab`}
              role="tab"
              aria-controls={`${idPrefix}-${phase.id}-panel`}
              aria-selected={activeId === phase.id}
              data-active={activeId === phase.id || undefined}
              key={phase.id}
              onClick={() => setActiveId(phase.id)}
            >
              <span>{phase.index}</span>
              <strong>{phase.title}</strong>
              <small>{phase.description}</small>
            </button>
          ))}
        </div>

        <div
          id={`${idPrefix}-${activePhase.id}-panel`}
          className={styles.processWorkspace}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-${activePhase.id}-tab`}
          key={activePhase.id}
        >
          <div className={styles.processMediaWrap}>
            <CarsystemMediaSlot
              availability={availability[activeMedia.id]}
              className={styles.processMedia}
              media={activeMedia}
              sizes="(min-width: 80rem) 38vw, (min-width: 64rem) 42vw, 100vw"
            />
            <div className={styles.processProgress} aria-hidden="true">
              <span>00</span>
              <i>
                <b
                  style={{
                    inlineSize: `${(Number(activePhase.index) / carsystemProcessPhases.length) * 100}%`,
                  }}
                />
              </i>
              <span>03</span>
            </div>
          </div>

          <ProcessDetails phase={activePhase} products={activeProducts} />
        </div>
      </div>

      <div className={styles.processAccordion}>
        {carsystemProcessPhases.map((phase) => {
          const isActive = activeId === phase.id;
          const media = carsystemMedia[phase.mediaId];
          const phaseProducts = phase.productSlugs
            .map((slug) => productBySlug.get(slug))
            .filter((product): product is CarsystemProduct => Boolean(product));

          return (
            <article data-active={isActive || undefined} key={phase.id}>
              <h3>
                <button
                  type="button"
                  aria-controls={`${idPrefix}-${phase.id}-mobile-panel`}
                  aria-expanded={isActive}
                  onClick={() => setActiveId(phase.id)}
                >
                  <span>{phase.index}</span>
                  {phase.title}
                  <i aria-hidden="true">{isActive ? "−" : "+"}</i>
                </button>
              </h3>
              <div
                id={`${idPrefix}-${phase.id}-mobile-panel`}
                className={styles.processAccordionPanel}
                data-open={isActive || undefined}
              >
                <div>
                  {isActive ? (
                    <>
                      <CarsystemMediaSlot
                        availability={availability[media.id]}
                        className={styles.processMedia}
                        media={media}
                        sizes="100vw"
                      />
                      <ProcessDetails phase={phase} products={phaseProducts} />
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProcessDetails({
  phase,
  products,
}: {
  phase: CarsystemProcessPhase;
  products: CarsystemProduct[];
}) {
  return (
    <div className={styles.processDetails}>
      <div className={styles.processDetailsHeading}>
        <p>Aktivna faza / {phase.index}</p>
        <h3>{phase.title}</h3>
        <span>{phase.description}</span>
      </div>

      <div className={styles.processCategories}>
        <p>Relevantne kategorije</p>
        <div>
          {phase.categories.map((category) => (
            <Link href={category.href} key={category.label}>
              <span>
                <Image
                  src={category.icon}
                  alt=""
                  width={34}
                  height={34}
                  aria-hidden="true"
                />
              </span>
              {category.label}
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.processProducts}>
        <p>Proizvodi iz lokalnog kataloga</p>
        <div>
          {products.map((product) => (
            <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
              <ProductThumb product={product} />
              <span>
                <small>{product.sku}</small>
                <strong>{product.name}</strong>
              </span>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </div>

      <Link className={styles.processCta} href={phase.cta.href}>
        {phase.cta.label}
        <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

function ProductThumb({ product }: { product: CarsystemProduct }) {
  const image = product.productImage ?? product.galleryImages[0] ?? null;

  return (
    <span className={styles.productThumb}>
      {image ? (
        <Image
          src={image.src}
          alt=""
          fill
          sizes="64px"
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true">CS</span>
      )}
    </span>
  );
}
