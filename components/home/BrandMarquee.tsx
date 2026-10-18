"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogoPlate, brandLogos, type BrandKey } from "./BrandLogoPlate";
import styles from "./CarsystemHomePage.module.css";

/**
 * Traka logotipa na početnoj (2026-10-18): sporo, ravnomerno kruženje u
 * neprekinutoj petlji. Druga kopija liste postoji samo da petlja nema skok:
 * `aria-hidden` + `inert`, pa je čitač ekrana i tastatura ne vide. Kruženje
 * staje na hover, dok je fokus u traci i na dugme za pauzu; uz smanjeno
 * kretanje traka je mirna i centrirana (CSS).
 */
export function BrandMarquee({
  brandKeys,
  links,
}: {
  brandKeys: BrandKey[];
  links: Partial<Record<BrandKey, string>>;
}) {
  const [paused, setPaused] = useState(false);

  const list = (copy: boolean) => (
    <ul
      aria-hidden={copy || undefined}
      aria-label={copy ? undefined : "Programski brendovi"}
      className={styles.marqueeList}
      inert={copy || undefined}
    >
      {brandKeys.map((brandKey) => {
        const href = links[brandKey];
        const logo = <BrandLogoPlate brandKey={brandKey} tone="mono" variant="rail" />;
        const brandName = brandLogos[brandKey].name;
        return (
          <li className={styles.marqueeItem} key={brandKey}>
            {href ? (
              <Link
                aria-label={`Otvorite stranicu brenda ${brandName}`}
                className={styles.brandRailMonoLink}
                href={href}
                // Traka je odmah vidljiva: prefetch bi preuzimao RSC svih brend stranica.
                prefetch={false}
                tabIndex={copy ? -1 : undefined}
              >
                {logo}
              </Link>
            ) : (
              <span className={styles.brandRailStatic}>{logo}</span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={styles.marquee} data-paused={paused || undefined}>
      <div className={styles.marqueeViewport}>
        <div className={styles.marqueeTrack}>
          {list(false)}
          {list(true)}
        </div>
      </div>
      <button
        aria-label={paused ? "Pokrenite kretanje trake brendova" : "Zaustavite kretanje trake brendova"}
        aria-pressed={paused}
        className={styles.marqueePause}
        onClick={() => setPaused((value) => !value)}
        type="button"
      >
        <span aria-hidden="true">{paused ? "▶" : "❚❚"}</span>
      </button>
    </div>
  );
}
