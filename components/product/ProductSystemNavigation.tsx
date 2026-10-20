import Link from "next/link";
import { getRmSystemNavigation } from "@/lib/rm-system-navigation";
import styles from "./ProductDetailExperience.module.css";

/**
 * Veza prezentacije R-M sistema i kartica za izbor artikala (2026-10-20). Prikazuje se
 * odmah ispod naslova, da izbor baza bude vidljiv bez skrolovanja i sa prezentacije.
 */
export function ProductSystemNavigation({ slug }: { slug: string }) {
  const navigation = getRmSystemNavigation(slug);
  if (!navigation) return null;
  return (
    <nav className={styles.systemNav} aria-label={navigation.title}>
      <p className={styles.systemNavTitle}>{navigation.title}</p>
      <ul className={styles.systemNavList}>
        {navigation.links.map((link) => {
          const current = link.slug === slug;
          return (
            <li key={link.slug}>
              <Link
                href={link.href}
                className={styles.systemNavLink}
                aria-current={current ? "page" : undefined}
                data-selection={link.selection || undefined}
              >
                <strong>{link.label}</strong>
                <small>{link.note}</small>
              </Link>
            </li>
          );
        })}
      </ul>
      {navigation.note ? <p className={styles.systemNavNote}>{navigation.note}</p> : null}
    </nav>
  );
}
