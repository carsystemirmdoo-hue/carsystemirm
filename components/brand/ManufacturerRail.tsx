"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CarsystemBrand } from "@/lib/carsystem-data";
import styles from "./ManufacturerRail.module.css";

type ManufacturerRailProps = {
  brands: CarsystemBrand[];
  description?: string;
  id: string;
  selectedSlug: string;
  title: string;
} & (
  | {
      mode: "filter";
      onSelect: (slug: string) => void;
    }
  | {
      mode: "links";
      onSelect?: never;
    }
);

export function ManufacturerRail({
  brands,
  description,
  id,
  mode,
  onSelect,
  selectedSlug,
  title,
}: ManufacturerRailProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedControlRef = useRef<HTMLElement | null>(null);
  const setSelectedControl = (node: HTMLElement | null) => {
    selectedControlRef.current = node;
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const selectedControl = selectedControlRef.current;
    if (!viewport || !selectedControl || viewport.scrollWidth <= viewport.clientWidth) {
      return;
    }

    const nextScrollLeft =
      selectedControl.offsetLeft -
      (viewport.clientWidth - selectedControl.offsetWidth) / 2;
    viewport.scrollTo({ left: Math.max(0, nextScrollLeft) });
  }, [selectedSlug]);

  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Proizvođači</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        {description ? <p>{description}</p> : null}
      </div>

      <div className={styles.viewport} ref={viewportRef}>
        <ul className={styles.list} aria-label={title}>
          {mode === "filter" ? (
            <li className={styles.item}>
              <button
                className={styles.control}
                type="button"
                aria-pressed={!selectedSlug}
                data-selected={!selectedSlug || undefined}
                ref={!selectedSlug ? setSelectedControl : undefined}
                onClick={() => onSelect("")}
              >
                <span className={styles.allMark} aria-hidden="true">
                  Sve
                </span>
                <span>Svi</span>
              </button>
            </li>
          ) : null}

          {brands.map((brand) => {
            const selected = brand.slug === selectedSlug;
            const content = (
              <>
                <span className={styles.logoFrame}>
                  <Image
                    className={styles.logo}
                    src={brand.logo}
                    alt=""
                    width={126}
                    height={48}
                  />
                </span>
                <span>{brand.name}</span>
              </>
            );

            return (
              <li className={styles.item} key={brand.slug}>
                {mode === "filter" ? (
                  <button
                    className={styles.control}
                    type="button"
                    aria-pressed={selected}
                    data-selected={selected || undefined}
                    ref={selected ? setSelectedControl : undefined}
                    onClick={() => onSelect(brand.slug)}
                  >
                    {content}
                  </button>
                ) : selected ? (
                  <span
                    className={styles.control}
                    aria-current="page"
                    data-selected
                    ref={setSelectedControl}
                  >
                    {content}
                  </span>
                ) : (
                  <Link className={styles.control} href={brand.routes.landing}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p className={styles.scrollHint} aria-hidden="true">
        Prevucite za još <span>→</span>
      </p>
    </section>
  );
}
