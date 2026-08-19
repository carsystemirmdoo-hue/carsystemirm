import Link from "next/link";
import { getDocumentById } from "@/lib/documents";
import { carsystemMultiChanger } from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

const swatchColors: Record<string, string> = {
  Plava: "#2f5fa8",
  Siva: "#8a8f98",
  Zelena: "#4f7a35",
  Žuta: "#d8c23a",
};

export function CarsystemMultiChanger() {
  const brochure = getDocumentById(carsystemMultiChanger.documentId);

  return (
    <section
      className={`${styles.section} ${styles.multiChangerSection}`}
      aria-labelledby="carsystem-multi-changer-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Inovacija</p>
          <h2 id="carsystem-multi-changer-title">{carsystemMultiChanger.title}</h2>
        </div>
        <p>{carsystemMultiChanger.description}</p>
      </header>

      <div className={styles.multiChangerGrid}>
        {carsystemMultiChanger.variants.map((variant) => (
          <Link
            className={styles.multiChangerCard}
            href={variant.href}
            key={variant.id}
          >
            <div className={styles.multiChangerSwatches} aria-hidden="true">
              <span style={{ background: swatchColors[variant.from] }} />
              <i>→</i>
              <span style={{ background: swatchColors[variant.to] }} />
            </div>
            <h3>{variant.title}</h3>
            <p>
              {variant.from} → {variant.to} <span>{variant.phase}</span>
            </p>
            <span className={styles.multiChangerCode}>Art.-Nr. {variant.productCode}</span>
          </Link>
        ))}
      </div>

      {brochure ? (
        <a
          className={styles.finishBrochureLink}
          href={brochure.file}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preuzmite Multi Changer brošuru
        </a>
      ) : null}
    </section>
  );
}
