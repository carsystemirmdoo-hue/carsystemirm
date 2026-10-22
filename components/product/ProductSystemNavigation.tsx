import Link from "next/link";
import { getRmSystemNavigation, type RmSystemLink } from "@/lib/rm-system-navigation";
import styles from "./ProductDetailExperience.styles";

const GROUP_TITLES: Record<Exclude<RmSystemLink["group"], "presentation">, string> = {
  selection: "Izbor baza po pakovanju",
  products: "Boje i baze linije",
  auxiliary: "Pomoćni proizvodi (aditivi, blenderi)",
};

/**
 * R-M linija u katalogu (2026-10-21): izbor baza, proizvodi linije i pomoćni proizvodi su
 * odvojeni i označeni; prezentacija sistema je običan link, ne izgleda kao izbor baze.
 */
export function ProductSystemNavigation({ slug }: { slug: string }) {
  const navigation = getRmSystemNavigation(slug);
  if (!navigation) return null;
  const presentations = navigation.links.filter((link) => link.group === "presentation" && link.slug !== slug);
  const groups = (Object.keys(GROUP_TITLES) as (keyof typeof GROUP_TITLES)[])
    .map((group) => ({ group, links: navigation.links.filter((link) => link.group === group) }))
    .filter((entry) => entry.links.length > 0);

  return (
    <nav className={styles.systemNav} aria-label={navigation.title}>
      <p className={styles.systemNavTitle}>{navigation.title}</p>
      {groups.map(({ group, links }) => (
        <section key={group} className={styles.systemNavGroup} aria-label={GROUP_TITLES[group]}>
          <h3 className={styles.systemNavGroupTitle}>{GROUP_TITLES[group]}</h3>
          <ul className={styles.systemNavList} data-group={group}>
            {links.map((link) => (
              <li key={link.slug + link.href}>
                <Link
                  href={link.href}
                  className={styles.systemNavLink}
                  aria-current={link.slug === slug ? "page" : undefined}
                  data-selection={link.selection || undefined}
                >
                  <strong>{link.label}</strong>
                  <small>{link.note}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {navigation.note ? <p className={styles.systemNavNote}>{navigation.note}</p> : null}
      {presentations.map((presentation) => (
        <p key={presentation.slug} className={styles.systemNavPresentation}>
          <Link href={presentation.href}>O sistemu: {presentation.label} →</Link>
        </p>
      ))}
    </nav>
  );
}
