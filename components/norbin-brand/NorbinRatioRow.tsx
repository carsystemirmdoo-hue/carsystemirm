"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import type { NorbinRatioRow as NorbinRatioRowData } from "./norbinBrandData";
import styles from "./NorbinBrandPage.module.css";

export function NorbinRatioRow({ row }: { row: NorbinRatioRowData }) {
  const rootRef = useRef<HTMLLIElement>(null);
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <li className={styles.ratioRow} data-revealed={revealed} ref={rootRef}>
      <div className={styles.ratioBase}>
        <strong>{row.base}</strong>
        <small>{row.baseLabel}</small>
      </div>

      <div className={styles.ratioCrossing} aria-hidden="true">
        <span className={styles.ratioValue}>{row.ratio}</span>
      </div>

      <div className={styles.ratioPartners}>
        <ul>
          {row.partners.map((partner) => (
            <li key={partner.code}>
              <span className={styles.ratioPartnerHardener}>{partner.code}</span>
              {partner.label}
              {partner.stocked ? (
                <span className={styles.ratioStockedTag}>u ponudi</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {row.note ? <p className={styles.ratioNote}>{row.note}</p> : null}
    </li>
  );
}
