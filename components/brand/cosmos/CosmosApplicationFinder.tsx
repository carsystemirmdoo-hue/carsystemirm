"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
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
 */
export function CosmosApplicationFinder({
  applications,
  productsBySlug,
}: Props) {
  const [activeSlug, setActiveSlug] = useState(applications[0]?.slug ?? "");
  const groupId = useId();
  const active =
    applications.find((item) => item.slug === activeSlug) ?? applications[0];

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const next =
      (index + (forward ? 1 : -1) + applications.length) % applications.length;
    setActiveSlug(applications[next].slug);
    const target = document.getElementById(`${groupId}-${applications[next].slug}`);
    target?.focus();
  };

  if (!active) return null;

  return (
    <section aria-labelledby="cosmos-finder-title" className={styles.finder}>
      <h2 className={styles.display} id="cosmos-finder-title">
        Šta farbate?
      </h2>

      <ul
        aria-labelledby="cosmos-finder-title"
        className={styles.finderOptions}
        role="radiogroup"
      >
        {applications.map((application, index) => (
          <li key={application.slug}>
            <button
              aria-checked={application.slug === active.slug}
              className={styles.finderOption}
              id={`${groupId}-${application.slug}`}
              onClick={() => setActiveSlug(application.slug)}
              onKeyDown={(event) => onKeyDown(event, index)}
              role="radio"
              tabIndex={application.slug === active.slug ? 0 : -1}
              type="button"
            >
              {application.label}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.finderResult}>
        <p className={styles.body}>{active.summary}</p>

        <ul className={styles.finderProducts}>
          {active.productSlugs.map((slug) => {
            const product = productsBySlug[slug];
            if (!product) return null;
            return (
              <li key={slug}>
                <Link
                  className={styles.finderProduct}
                  href={product.href}
                >
                  <Image
                    alt={product.imageAlt}
                    height={800}
                    loading="lazy"
                    sizes="180px"
                    src={product.image}
                    width={800}
                  />
                  <span className={styles.finderProductName}>{product.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <Link className={styles.finderLink} href={active.catalogueHref}>
          Pogledajte sve u katalogu →
        </Link>
      </div>
    </section>
  );
}
