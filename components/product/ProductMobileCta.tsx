"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import styles from "./ProductDetailPage.module.css";

export function ProductMobileCta({ product }: { product: CarsystemProduct }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > Math.min(520, window.innerHeight * 0.58));
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  return (
    <div
      className={`${styles.mobileCta} ${
        isVisible ? styles.mobileCtaVisible : styles.mobileCtaHidden
      }`}
      aria-label="Brzi upit za proizvod"
    >
      <span className={styles.mobileCtaText}>
        <strong>{product.name}</strong>
        <span>Upit i savet za izbor proizvoda</span>
      </span>
      <Link
        className={`${styles.mobileCtaButton} cs-magnetic-cta`}
        href={`/kontakt?tema=proizvod&proizvod=${product.slug}`}
        data-cursor="button"
        data-motion-surface
      >
        Pošalji upit
      </Link>
    </div>
  );
}
