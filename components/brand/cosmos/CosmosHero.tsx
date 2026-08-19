"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import type { CosmosHeroCan } from "@/lib/cosmos-lac-brand-data";
import styles from "./CosmosBrandPage.module.css";
import { useHeroRotation } from "./useHeroRotation";
import { useScrollProgress } from "./useScrollProgress";

/**
 * Six arc slots. All geometry — size, position, depth — lives in CSS so it can
 * be re-composed per breakpoint: the desktop arc sweeps across the full frame,
 * but on mobile the text occupies the lower half, so the cans must move up and
 * out of the way rather than simply scale down. See .heroCan in the stylesheet.
 */
const ARC_SLOTS = [0, 1, 2, 3, 4, 5] as const;

type Props = {
  cans: CosmosHeroCan[];
  variantCount: number;
  familyCount: number;
};

export function CosmosHero({ cans, variantCount, familyCount }: Props) {
  const heroRef = useRef<HTMLElement>(null);
  useScrollProgress(heroRef, { cssVariable: "--hero-progress", mode: "exit" });
  useHeroRotation(heroRef);

  return (
    <section
      className={styles.hero}
      ref={heroRef}
      style={{ ["--hero-accent" as string]: cans[0]?.accent ?? "#e63616" }}
      aria-labelledby="cosmos-hero-title"
    >
      <div className={styles.heroGlow} aria-hidden="true" />

      <div className={styles.heroArc} aria-hidden="true">
        {ARC_SLOTS.map((slot) => {
          const can = cans[slot];
          if (!can) return null;
          return (
            <Image
              key={can.slug}
              alt=""
              className={styles.heroCan}
              data-slot={slot}
              height={800}
              priority={slot === 0}
              loading={slot === 0 ? undefined : "lazy"}
              sizes="480px"
              src={can.image}
              width={800}
            />
          );
        })}
      </div>

      {/* Subtle affordance; removed permanently after the first rotation. */}
      <p className={styles.heroHint} aria-hidden="true">
        Prevuci za rotaciju
      </p>

      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>Cosmos Lac · aerosolni program</p>
        <h1 className={styles.display} id="cosmos-hero-title">
          Boja koja stiže odmah.
        </h1>
        <p className={styles.body}>
          {variantCount} verifikovanih varijanti iz {familyCount} COSMOS linija —
          dostupnih kroz Carsystem partnersku mrežu.
        </p>
        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} href="/prodavnice">
            Pronađi najbližu prodavnicu
            <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.ctaSecondary} href="/katalog?brend=cosmos-lac">
            Pogledaj sve COSMOS proizvode
          </Link>
        </div>
      </div>
    </section>
  );
}
