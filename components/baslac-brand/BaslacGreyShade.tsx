"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./BaslacBrandPage.module.css";

const greyShadeBases = [
  { code: "20-24", label: "siva", swatch: "#8a8f8e" },
  { code: "20-34", label: "bela", swatch: "#e9e9e6" },
  { code: "20-94", label: "crna", swatch: "#26282a" },
];

export function BaslacGreyShade() {
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.5 },
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      id="grey-shade"
      className={`${styles.section} ${styles.greyShadeSection}`}
      data-active={!reducedMotion && active ? "true" : undefined}
      aria-labelledby="baslac-grey-shade-title"
    >
      <div className={styles.greyShadeIntro}>
        <p className={styles.sectionKicker}>Sanding primer-filler sistem</p>
        <h2 id="baslac-grey-shade-title">
          Tri baze. Jedna logika mešanja nijanse.
        </h2>
        <p>
          20-24 (siva), 20-34 (bela) i 20-94 (crna) se, prema zvaničnom
          posteru sivih nijansi, mogu međusobno mešati za dobijanje prelazne
          nijanse podloge bliže boji koja sledi. Ovo je tehnički princip
          sistema — tačna dostupnost i odnos mešanja potvrđuju se prema
          važećem tehničkom listu i lokalnoj ponudi.
        </p>
      </div>

      <ol className={styles.greyShadePoster} aria-label="Baze sistema sivih nijansi">
        {greyShadeBases.map((base) => (
          <li key={base.code}>
            <span
              className={styles.greyShadeSwatch}
              style={{ background: base.swatch }}
              aria-hidden="true"
            />
            <strong>{base.code}</strong>
            <small>{base.label}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
