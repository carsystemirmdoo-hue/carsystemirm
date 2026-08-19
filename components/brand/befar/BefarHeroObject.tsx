"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { befarHero } from "@/lib/befar-brand-data";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./BefarBrandPage.module.css";

/** Maksimalna rotacija objekta kroz ceo hero — namerno mala. */
const MAX_ROTATION_DEG = 3.5;

/**
 * Hero objekat sa vrlo suptilnom rotacijom vezanom za scroll.
 *
 * Jedan passive scroll listener, rAF-throttled, i to samo dok je hero u
 * viewportu (IntersectionObserver ga gasi). Nema trajne rAF petlje, nema
 * lebdenja, nema filtera nad fotografijom — piše se samo jedna CSS promenljiva.
 */
export function BefarHeroObject() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || reducedMotion) return;

    let frame = 0;
    let visible = false;

    const apply = () => {
      frame = 0;
      const rect = wrap.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      // 0 kada je objekat na dnu viewporta, 1 kada izađe na vrh.
      const progress = Math.min(1, Math.max(0, 1 - (rect.top + rect.height / 2) / viewport));
      wrap.style.setProperty("--befar-hero-rotate", `${(progress - 0.5) * 2 * MAX_ROTATION_DEG}deg`);
      wrap.style.setProperty("--befar-hero-lift", `${progress * -10}px`);
    };

    const schedule = () => {
      if (!visible || frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      },
      { threshold: 0 },
    );
    observer.observe(wrap);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    apply();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [reducedMotion]);

  return (
    <div className={styles.heroObject} ref={wrapRef}>
      <Image
        alt={befarHero.object.alt}
        className={styles.heroObjectImage}
        height={befarHero.object.height}
        priority
        sizes="(min-width: 64rem) 58vw, 100vw"
        src={befarHero.object.src}
        width={befarHero.object.width}
      />
    </div>
  );
}
