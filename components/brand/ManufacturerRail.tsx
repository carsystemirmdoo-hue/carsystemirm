"use client";

import Link from "next/link";
import { BrandLogoMark } from "@/components/brand/BrandLogoMark";
import { useEffect, useRef } from "react";
import type { CarsystemBrand } from "@/lib/carsystem-data";
import { BRAND_LINKS } from "@/components/layout/navigation-data";
import type { CSSProperties } from "react";
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

/*
 * Optički ujednačena visina znaka: iste srazmere kao meni brendova (`menuLogoHeight`,
 * najviši znak 62 px), svedene na visinu trake (40 px). Širina je i dalje ograničena.
 */
const RAIL_LOGO_MAX = 40;
const MENU_LOGO_MAX = 62;
const railLogoHeight = new Map(
  BRAND_LINKS.flatMap((link) =>
    link.menuLogoHeight ? [[link.href.split("/").pop() ?? "", Math.round((link.menuLogoHeight / MENU_LOGO_MAX) * RAIL_LOGO_MAX)] as const] : [],
  ),
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
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <rect x="1" y="1" width="7" height="7" />
                    <rect x="10" y="1" width="7" height="7" />
                    <rect x="1" y="10" width="7" height="7" />
                    <rect x="10" y="10" width="7" height="7" />
                  </svg>
                </span>
                <span>Svi</span>
              </button>
            </li>
          ) : null}

          {/* Brend ponuđen u okviru drugog (RUPES → Carsystem) nema svoje mesto u traci. */}
          {brands.filter((brand) => !brand.offeredWithin).map((brand) => {
            const selected = brand.slug === selectedSlug;
            const content = (
              <>
                <span
                  className={styles.logoFrame}
                  style={railLogoHeight.has(brand.slug) ? ({ "--rail-logo-h": `${railLogoHeight.get(brand.slug)}px` } as CSSProperties) : undefined}
                >
                  <BrandLogoMark
                    brand={brand}
                    className={styles.logo}
                    tone="onLight"
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
