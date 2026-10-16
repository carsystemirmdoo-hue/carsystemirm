"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./AccountEntryStrip.module.css";

/**
 * Traka sa ulazima za kupce i zaposlene, iznad zaglavlja i na strani „sajt u pripremi“.
 *
 * Oznake su samo nagoveštaj za prikaz (kolačići `cs_kupac` / `cs_zaposleni`, bez podataka):
 * da li je korisnik zaista prijavljen i šta sme odlučuje server pri svakom zahtevu. Bez
 * oznake se ne pravi nijedan zahtev — javne strane ostaju statične.
 */
export function AccountEntryStrip({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname() ?? "/";
  const [marks, setMarks] = useState({ customer: false, staff: false });
  useEffect(() => {
    const c = document.cookie;
    setMarks({ customer: /(?:^|;\s*)cs_kupac=1/.test(c), staff: /(?:^|;\s*)cs_zaposleni=1/.test(c) });
  }, [pathname]);
  // Povratak posle prijave kupca samo na javnu stranu (ne na prijavu ili „sajt u pripremi“).
  const back = /^\/(?!prijava|site-u-pripremi|kupac)/.test(pathname) && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
  return (
    <nav className={styles.strip} data-tone={tone} aria-label="Prijava">
      <div className={styles.inner}>
        {marks.customer ? (
          <Link href="/kupac" className={styles.link}>Moj nalog</Link>
        ) : (
          <Link href={`/prijava/kupac${back}`} className={styles.link} data-primary="true">Prijava kupca</Link>
        )}
        <span className={styles.sep} aria-hidden="true" />
        {marks.staff ? (
          <Link href="/portal" className={styles.link}>Poslovni portal</Link>
        ) : (
          <Link href="/prijava" className={styles.link}>Za zaposlene</Link>
        )}
      </div>
    </nav>
  );
}
