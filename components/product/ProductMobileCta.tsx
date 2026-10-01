"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProductVariant } from "@/components/product/ProductVariantProvider";
import styles from "./ProductDetailPage.module.css";

/**
 * Lepljivi CTA na mobilnom.
 *
 * Naziv i adresa upita dolaze iz zajedničkog konteksta varijante — na 390 px je
 * ovo često jedini vidljivi CTA, pa bi varijanta koja se ovde razilazi sa
 * izborom poslala upit za pogrešan proizvod.
 */
export function ProductMobileCta() {
  const { activeVariant, inquiryHref } = useProductVariant();
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
        <strong>{activeVariant.name}</strong>
        <span>Upit i savet za izbor proizvoda</span>
      </span>
      <Link
        className={`${styles.mobileCtaButton} cs-magnetic-cta cs-theme-wipe-card`}
        href={inquiryHref}
        data-cursor="button"
        data-motion-surface
        data-motion="theme-wipe"
        data-product-inquiry
      >
        <span>Pošaljite upit</span>
      </Link>
    </div>
  );
}
