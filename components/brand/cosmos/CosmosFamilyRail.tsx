"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CosmosFamily } from "@/lib/cosmos-lac-brand-data";
import styles from "./CosmosBrandPage.module.css";
import { useMeasuredWidth, useScrollProgress } from "./useScrollProgress";

type Props = {
  families: CosmosFamily[];
  otherVariants: number;
  otherLines: number;
  catalogueHref: string;
};

/**
 * One pinned horizontal rail holding every featured family (specification §7).
 *
 * Desktop: the section is `panelHeight + travel` tall and the track is pinned
 * with CSS `position: sticky`, translating horizontally in exact 1:1 step with
 * the vertical runway. Because travel is derived from the same measured width
 * as the panels, the horizontal distance always equals the overflow — the rail
 * cannot end early or jump on release.
 *
 * Mobile: no pin at all. The same markup becomes a native scroll-snap carousel,
 * so seven families cost one fixed screen instead of seven, and vertical page
 * scrolling is never trapped.
 */
export function CosmosFamilyRail({
  families,
  otherVariants,
  otherLines,
  catalogueHref,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  /*
   * -1 means "no panel is active", which is the correct desktop state: there,
   * colour belongs to hover and focus only. The carousel effect below sets a
   * real index only when it actually runs, so a pointer-driven layout never
   * ships with one panel stuck in its accent colour.
   */
  const [activeIndex, setActiveIndex] = useState(-1);

  useScrollProgress(sectionRef, {
    cssVariable: "--rail-progress",
    mode: "through",
  });
  useMeasuredWidth(stickyRef);

  // Touch/reduced-motion mode only: track which panel sits nearest the centre
  // so it can carry the family colour in place of a hover state.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const isCarousel = () =>
      window.matchMedia("(max-width: 767px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isCarousel()) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = track.getBoundingClientRect();
      const centre = bounds.left + bounds.width / 2;
      let closest = 0;
      let smallest = Number.POSITIVE_INFINITY;
      Array.from(track.children).forEach((child, index) => {
        const rect = child.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - centre);
        if (distance < smallest) {
          smallest = distance;
          closest = index;
        }
      });
      setActiveIndex(closest);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      aria-label="COSMOS LAC linije proizvoda"
      className={styles.rail}
      ref={sectionRef}
    >
      <div className={styles.railSticky} ref={stickyRef}>
        <div className={styles.railTrack} ref={trackRef}>
          {families.map((family, index) => (
            <Link
              className={styles.panel}
              data-active={activeIndex === index ? "true" : undefined}
              href={family.catalogueHref}
              key={family.slug}
              style={
                {
                  "--panel-accent": family.accent,
                  "--panel-accent-text": family.accentTextColor,
                } as React.CSSProperties
              }
            >
              <p className={styles.eyebrow}>{family.eyebrow}</p>
              <h3 className={styles.panelName}>{family.name}</h3>
              <span className={styles.panelCanWrap}>
                <Image
                  alt={family.signatureImageAlt}
                  className={styles.panelCan}
                  height={800}
                  loading="lazy"
                  sizes="220px"
                  src={family.signatureImage}
                  width={800}
                />
              </span>
              <span className={styles.panelCta}>Pogledajte liniju</span>
            </Link>
          ))}

          {/*
            The seven featured families do not account for the whole verified
            COSMOS range, so the rail must not imply that they do.
          */}
          <Link
            className={`${styles.panel} ${styles.panelTerminal}`}
            data-active={activeIndex === families.length ? "true" : undefined}
            href={catalogueHref}
          >
            <p className={styles.eyebrow}>
              +{otherVariants} varijanti u {otherLines} linija
            </p>
            <h3 className={styles.panelName}>Sve COSMOS linije</h3>
            <span className={styles.panelTerminalArrow} aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
      </div>

      <div className={styles.railProgress} aria-hidden="true">
        {Array.from({ length: families.length + 1 }).map((_, index) => (
          <span
            className={styles.railProgressSegment}
            data-active={activeIndex === index ? "true" : undefined}
            key={index}
            style={
              {
                "--segment-accent": families[index]?.accent ?? "#f4f7f2",
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </section>
  );
}
