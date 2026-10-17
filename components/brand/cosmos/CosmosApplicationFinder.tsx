"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import type { CosmosApplication } from "@/lib/cosmos-lac-brand-data";
import styles from "./CosmosBrandPage.module.css";

export type FinderProduct = {
  slug: string;
  name: string;
  image: string;
  imageAlt: string;
  /** Kanonsko odredište; za konsolidovanu varijantu je to porodični PDP. */
  href: string;
};

type Props = {
  applications: CosmosApplication[];
  productsBySlug: Record<string, FinderProduct>;
};

/**
 * Application finder (specification §11).
 *
 * Deliberately not a filter sidebar and not a second catalogue: one question,
 * seven options, three real products, one link into the existing catalogue.
 * Selection is local state only — no navigation and no data fetching.
 *
 * Implemented as a real radiogroup with roving arrow-key focus so it is
 * operable from the keyboard rather than being a div soup.
 *
 * Promena izbora (2026-10-17): izmereno je da render traje ~20–30 ms, a čekanje
 * dolazi od novih slika (lazy, preko optimizatora) — ranije su stare kartice
 * nestajale odmah, a nove stajale prazne dok slike ne stignu. Sada se slike
 * novog izbora prvo učitaju i dekodiraju; dok traju, stari sadržaj je blago
 * zamućen i zatamnjen, a posle ~250 ms se pojavljuje diskretan indikator.
 * Spreman sadržaj (keš) se menja odmah, bez veštačkog čekanja. Važi samo
 * poslednji izbor, a visina bloka se drži tokom zamene.
 */

const IMAGE_SIZES = "180px";
const SLOW_AFTER_MS = 250;

function imagePropsFor(product: FinderProduct) {
  return getImageProps({
    alt: product.imageAlt,
    height: 800,
    sizes: IMAGE_SIZES,
    src: product.image,
    width: 800,
  }).props;
}

/** Učitava i dekodira slike izbora istim URL-om koji će kartica koristiti. */
function prepareImages(products: FinderProduct[]) {
  return Promise.all(
    products.map((product) => {
      const props = imagePropsFor(product);
      const image = new window.Image();
      if (props.sizes) image.sizes = props.sizes;
      if (props.srcSet) image.srcset = props.srcSet;
      image.src = props.src;
      return image.decode().catch(() => undefined);
    }),
  );
}

function areImagesReady(products: FinderProduct[]) {
  return products.every((product) => {
    const props = imagePropsFor(product);
    const image = new window.Image();
    if (props.sizes) image.sizes = props.sizes;
    if (props.srcSet) image.srcset = props.srcSet;
    image.src = props.src;
    return image.complete && image.naturalWidth > 0;
  });
}
export function CosmosApplicationFinder({
  applications,
  productsBySlug,
}: Props) {
  // `activeSlug` je izbor (radio grupa odmah reaguje); `shownSlug` je sadržaj
  // koji se vidi i menja se tek kada su slike izbora spremne.
  const [activeSlug, setActiveSlug] = useState(applications[0]?.slug ?? "");
  const [shownSlug, setShownSlug] = useState(applications[0]?.slug ?? "");
  const [phase, setPhase] = useState<"idle" | "preparing" | "slow">("idle");
  const [revealKey, setRevealKey] = useState(0);
  const requestRef = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const groupId = useId();
  const active =
    applications.find((item) => item.slug === activeSlug) ?? applications[0];
  const shown =
    applications.find((item) => item.slug === shownSlug) ?? applications[0];

  const productsOf = useCallback(
    (application: CosmosApplication) =>
      application.productSlugs
        .map((slug) => productsBySlug[slug])
        .filter((product): product is FinderProduct => Boolean(product)),
    [productsBySlug],
  );

  const select = useCallback(
    (slug: string) => {
      setActiveSlug(slug);
      const request = ++requestRef.current;
      const next = applications.find((item) => item.slug === slug);
      if (!next) return;
      const products = productsOf(next);

      const show = () => {
        if (request !== requestRef.current) return; // zastareo izbor
        setShownSlug(slug);
        setPhase("idle");
        setRevealKey((key) => key + 1);
        // Visina se pušta posle otkrivanja novih kartica.
        window.setTimeout(() => {
          if (request === requestRef.current) setHeldHeight(null);
        }, 360);
      };

      if (resultRef.current) setHeldHeight(resultRef.current.offsetHeight);
      if (areImagesReady(products)) {
        show();
        return;
      }
      setPhase("preparing");
      const slow = window.setTimeout(() => {
        if (request === requestRef.current) setPhase("slow");
      }, SLOW_AFTER_MS);
      void prepareImages(products).then(() => {
        window.clearTimeout(slow);
        show();
      });
    },
    [applications, productsOf],
  );

  // Kad se korisnik prvi put približi opcijama, slike svih izbora se pripreme
  // u pozadini, pa je kasnija promena najčešće trenutna.
  const warmedRef = useRef(false);
  const warmAll = useCallback(() => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    void prepareImages(applications.flatMap(productsOf));
  }, [applications, productsOf]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next =
      (index + (forward ? 1 : -1) + applications.length) % applications.length;
    select(applications[next].slug);
    const target = document.getElementById(`${groupId}-${applications[next].slug}`);
    target?.focus();
  };

  if (!active || !shown) return null;

  return (
    <section aria-labelledby="cosmos-finder-title" className={styles.finder}>
      <h2 className={styles.display} id="cosmos-finder-title">
        Šta farbate?
      </h2>

      {/* Radio grupa nije lista: `<li>` pod `role="radiogroup"` je axe „listitem”. */}
      <div
        aria-labelledby="cosmos-finder-title"
        className={styles.finderOptions}
        onFocus={warmAll}
        onPointerEnter={warmAll}
        role="radiogroup"
      >
        {applications.map((application, index) => (
          <button
            aria-checked={application.slug === active.slug}
            className={styles.finderOption}
            id={`${groupId}-${application.slug}`}
            key={application.slug}
            onClick={() => select(application.slug)}
            onKeyDown={(event) => onKeyDown(event, index)}
            role="radio"
            tabIndex={application.slug === active.slug ? 0 : -1}
            type="button"
          >
            {application.label}
          </button>
        ))}
      </div>

      <div
        aria-busy={phase !== "idle"}
        className={styles.finderResult}
        data-phase={phase}
        data-reduced-motion={reducedMotion || undefined}
        ref={resultRef}
        style={heldHeight ? { minHeight: heldHeight } : undefined}
      >
        <div className={styles.finderStage} key={revealKey} data-reveal={revealKey > 0 || undefined}>
          <p className={styles.body}>{shown.summary}</p>

          <ul className={styles.finderProducts}>
            {shown.productSlugs.map((slug, index) => {
              const product = productsBySlug[slug];
              if (!product) return null;
              return (
                <li key={slug} style={{ "--finder-index": index } as React.CSSProperties}>
                  <Link
                    className={styles.finderProduct}
                    href={product.href}
                  >
                    <Image
                      alt={product.imageAlt}
                      height={800}
                      loading="lazy"
                      sizes={IMAGE_SIZES}
                      src={product.image}
                      width={800}
                    />
                    <span className={styles.finderProductName}>{product.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link className={styles.finderLink} href={shown.catalogueHref}>
            Pogledajte sve u katalogu →
          </Link>
        </div>

        <span className={styles.finderLoading} aria-hidden={phase !== "slow"} role="status">
          {phase === "slow" ? `Pripremamo: ${active.label}` : ""}
        </span>
      </div>
    </section>
  );
}
