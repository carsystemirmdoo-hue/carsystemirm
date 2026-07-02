import Link from "next/link";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import styles from "./CatalogPage.module.css";

export function CatalogSupportCta() {
  return (
    <section className={styles.supportCta} aria-labelledby="catalog-support-title">
      <div>
        <p className={styles.kicker}>Podrška</p>
        <h2 id="catalog-support-title">Niste sigurni koji proizvod vam treba?</h2>
        <p>
          Naš tim i partnerska mreža mogu pomoći oko izbora proizvoda, tehničke
          podrške i najbliže prodavnice.
        </p>
      </div>
      <div className={styles.supportActions}>
        <SplitContactCta inquiryHref="/kontakt" />
        <Link
          className={`${styles.secondaryButton} cs-interactive-surface`}
          href="/prodavnice"
          data-cursor="button"
          data-motion-surface
        >
          Pronađi prodavnicu
        </Link>
      </div>
    </section>
  );
}
