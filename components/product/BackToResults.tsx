"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CATALOG_RETURN_STORAGE_KEY = "carsystem:catalog:return";

/**
 * Vidljiv povratak na rezultate kataloga (2026-10-20).
 *
 * Vodi na poslednju adresu kataloga sa filterima i sortiranjem; katalog sam
 * obnavlja broj učitanih kartica i skrol. Bez zapisa (direktan link, nova
 * kartica) nudi ceo katalog. Izbor varijante na strani ne dodaje korake
 * istorije, pa i „Nazad“ pregledača vraća na prethodnu stvarnu stranicu.
 */
export function BackToResults({ className }: { className?: string }) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(CATALOG_RETURN_STORAGE_KEY);
      if (stored && stored.startsWith("/katalog")) setHref(stored);
    } catch {
      // sessionStorage nedostupan — ostaje link na ceo katalog.
    }
  }, []);

  return (
    <Link className={className} href={href ?? "/katalog"} data-back-to-results>
      <span aria-hidden="true">←</span> {href ? "Nazad na rezultate" : "Katalog proizvoda"}
    </Link>
  );
}
