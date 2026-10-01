import Link from "next/link";
import type { PublicProgramGroup, RefinishPhase } from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function ProgramHero({
  phases,
  productCount,
  program,
}: {
  phases: RefinishPhase[];
  productCount: number;
  program: PublicProgramGroup;
}) {
  const phaseSummary = phases.map((phase) => phase.name).join(" / ");

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Putanja">
        <ol>
          <li>
            <Link href="/">Početna</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
          </li>
          <li>
            <Link href="/program">Programi</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
          </li>
          <li className={styles.breadcrumbCurrent} aria-current="page">
            {program.name}
          </li>
        </ol>
      </nav>

      <section className={`${styles.hero} ${styles.programHero}`} aria-labelledby="program-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Programska celina</p>
          <h1 id="program-title" className={styles.title}>
            {program.name}
          </h1>
          <p className={styles.heroLead}>
            Tehnički izbor po fazi refinish procesa, povezanim brendovima i
            nameni proizvoda.
          </p>
          <p className={styles.subtitle}>{program.description}</p>

          <div className={styles.badgeRow} aria-label="Faze i kategorije">
            {phaseSummary ? <span className={styles.statusChip}>Faza: {phaseSummary}</span> : null}
            <span className={styles.badge}>{productCount} proizvoda</span>
          </div>

          <div className={styles.heroActions}>
            <Link
              className={styles.primaryButton}
              href={`/kontakt?tema=proizvod&program=${program.slug}`}
            >
              Pošaljite upit
            </Link>
            <Link className={styles.secondaryButton} href={`/katalog?program=${program.slug}`}>
              Pregledajte proizvode
            </Link>
            <Link className={styles.ghostButton} href="/prodavnice">
              Pronađite prodavnicu
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.programStage}>
            <div className={styles.programSignal}>
              <span>Program</span>
              <strong>{program.shortName}</strong>
              <small>Proces, izbor i tehnička podrška</small>
            </div>
            <div className={styles.programStageLines} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
