"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./Sistemi.styles";

/**
 * Podmeni „Sistemi i programi“: svih sedam stavki, aktivna je označena (`aria-current`).
 * Na telefonu se traka pomera vodoravno unutar sebe, a aktivna stavka se pri otvaranju
 * dovodi u vidno polje bez pomeranja strane.
 */
export function SistemiSubnav({
  links,
  activeHref,
}: {
  links: { href: string; title: string }[];
  activeHref: string;
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollLeft = Math.max(0, left);
  }, [activeHref]);

  return (
    <nav aria-label="Sistemi i programi" className={styles.subnav} ref={navRef}>
      <ul className={styles.subnavList}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              aria-current={link.href === activeHref ? "page" : undefined}
              className={styles.subnavLink}
              href={link.href}
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
