import Image from "next/image";
import Link from "next/link";
import { BaslacMediaSlot } from "./BaslacMediaSlot";
import { baslacMedia, type BaslacMediaAvailability } from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

const heroContent = {
  eyebrow: "baslac · Automotive Refinish Made Simple",
  title: "Sledeći korak samo ima smisla.",
  description:
    "Povezan sistem kitova, prajmera, boja, lakova i pomoćnih proizvoda za profesionalne refinish popravke.",
  primaryCta: { href: "#repair-process", label: "Pogledajte kompletan proces" },
  secondaryCta: {
    href: "/kontakt?tema=proizvod&brend=baslac",
    label: "Svi baslac proizvodi",
  },
  mediaId: "hero-system",
} as const;

export function BaslacHero({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const media = baslacMedia[heroContent.mediaId];

  return (
    <section className={styles.hero} aria-labelledby="baslac-hero-title">
      <nav className={styles.breadcrumb} aria-label="Putanja stranice">
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong>baslac</strong>
      </nav>

      <div className={styles.heroStage}>
        <div className={styles.heroCopy}>
          <div className={styles.heroBrand}>
            <span className={styles.heroLogoPlate}>
              <Image
                src="/brands/baslac.svg"
                alt="baslac"
                width={100}
                height={89}
                priority
              />
            </span>
            <p>{heroContent.eyebrow}</p>
          </div>

          <div className={styles.heroMessage}>
            <h1 id="baslac-hero-title">{heroContent.title}</h1>
            <p className={styles.heroDescription}>{heroContent.description}</p>
          </div>

          <div className={styles.heroActions}>
            <Link
              className={styles.primaryButton}
              href={heroContent.primaryCta.href}
            >
              {heroContent.primaryCta.label}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className={styles.secondaryButton}
              href={heroContent.secondaryCta.href}
            >
              {heroContent.secondaryCta.label}
            </Link>
          </div>
        </div>

        <BaslacMediaSlot
          availability={availability[media.id]}
          className={styles.heroMedia}
          media={media}
          priority
        />
      </div>
    </section>
  );
}
