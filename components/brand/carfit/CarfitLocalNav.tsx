"use client";

import { useEffect, useState } from "react";
import type { CarfitNavItem } from "@/lib/carfit-brand-data";
import styles from "./CarfitBrandPage.module.css";

/**
 * Lokalna navigacija brend stranice sa scrollspy stanjem.
 *
 * Sticky offset prati visinu globalnog auto-hide headera (`--cf-nav-offset`),
 * pa se traka zaustavlja ispod njega umesto da se preklapa.
 */
export function CarfitLocalNav({ items }: { items: CarfitNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (sections.length === 0 || !("IntersectionObserver" in window)) return undefined;

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
          else visible.delete(entry.target.id);
        }

        if (visible.size === 0) return;

        const [topId] = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
        setActiveId(topId);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={styles.localNav} aria-label="Sekcije Car Fit stranice">
      <div className={styles.container}>
        <ul className={styles.localNavList}>
          {items.map((item) => (
            <li key={item.id}>
              <a
                className={styles.localNavLink}
                href={`#${item.id}`}
                aria-current={activeId === item.id ? "true" : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
