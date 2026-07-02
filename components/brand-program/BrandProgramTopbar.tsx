import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import styles from "./BrandProgramPage.module.css";

export function BrandProgramTopbar({
  activeSection,
}: {
  activeSection: "brand" | "program" | "catalog";
}) {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link className={styles.brandLink} href="/" aria-label="Carsystem i R-M početna">
          <span className={styles.brandDisc}>RM</span>
          <span className={styles.brandCopy}>
            <strong>Carsystem i R-M</strong>
            <span>Profesionalni refinish katalog</span>
          </span>
        </Link>

        <nav className={styles.navLinks} aria-label="Navigacija kataloga">
          <Link
            aria-current={activeSection === "program" ? "page" : undefined}
            href="/program"
          >
            Programi
          </Link>
          <Link
            aria-current={activeSection === "catalog" ? "page" : undefined}
            href="/katalog"
          >
            Katalog
          </Link>
          <Link
            aria-current={activeSection === "brand" ? "page" : undefined}
            href="/brendovi"
          >
            Brendovi
          </Link>
          <Link href="/prodavnice">Prodavnice</Link>
          <Link href="/kontakt">Kontakt</Link>
        </nav>

        <div className={styles.topbarActions}>
          <Link className={styles.topbarCta} href="/prodavnice">
            Pronađi prodavnicu
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
