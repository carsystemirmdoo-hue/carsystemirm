import Image from "next/image";
import Link from "next/link";
import { carsystemHero } from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.styles";

/**
 * Uvodni blok Carsystem stranice: fotografija preko cele širine bloka, a naslov, uvod i
 * dugmad stoje preko nje (odluka vlasnika 2026-10-15). Fotografiju je dostavio vlasnik;
 * izvorni fajl je sačuvan pod izvornim imenom, a sajt dobija optimizovane derivate kroz
 * next/image. Raniji prikaz (kompozicija proizvoda sa fazama rada) je uklonjen iz bloka.
 */
const HERO_PHOTO = {
  src: "/images/brands/carsystem/hero/CS-Lackieranzug-Explorer-Startbanner-2-min.jpg",
  alt: "Lakirer u Carsystem zaštitnom odelu i polumaski nanosi boju pištoljem na crveni deo karoserije",
} as const;

export function CarsystemHero() {
  return (
    <section className={styles.hero} data-photo-hero="" aria-labelledby="carsystem-hero-title">
      <div className={styles.heroPhoto}>
        <Image
          src={HERO_PHOTO.src}
          alt={HERO_PHOTO.alt}
          fill
          priority
          sizes="100vw"
        />
      </div>
      <div className={styles.heroScrim} aria-hidden="true" />

      <nav className={styles.breadcrumb} aria-label="Putanja stranice">
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong>Carsystem</strong>
      </nav>

      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          {/* Logotip je u headeru; ovde ostaje samo prateći natpis (2026-10-17). */}
          <p className={styles.heroBrand}>{carsystemHero.eyebrow}</p>

          <div className={styles.heroMessage}>
            <p className={styles.heroSlogan}>{carsystemHero.slogan}</p>
            <h1 id="carsystem-hero-title">{carsystemHero.title}</h1>
            <p>{carsystemHero.description}</p>
          </div>

          <div className={styles.heroActions}>
            <Link className={`${styles.primaryButton} cs-cta`} data-cta-on="theme" href={carsystemHero.primaryCta.href}>
              {carsystemHero.primaryCta.label}
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              className={`${styles.secondaryButton} cs-cta`} data-cta-on="theme"
              href={carsystemHero.secondaryCta.href}
            >
              {carsystemHero.secondaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
