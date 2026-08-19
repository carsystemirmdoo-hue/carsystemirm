import Link from "next/link";
import { getDocumentById } from "@/lib/documents";
import { carsystemFinishSystem } from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

export function CarsystemFinishSystem() {
  const brochure = getDocumentById(carsystemFinishSystem.documentId);

  return (
    <section
      className={`${styles.section} ${styles.finishSystemSection}`}
      aria-labelledby="carsystem-finish-system-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Polish X-Serie</p>
          <h2 id="carsystem-finish-system-title">{carsystemFinishSystem.title}</h2>
        </div>
        <p>{carsystemFinishSystem.description}</p>
      </header>

      <ol className={styles.finishSteps}>
        {carsystemFinishSystem.steps.map((step) => (
          <li key={step.id} className={styles.finishStep}>
            <span className={styles.finishStepIndex}>{step.index}</span>
            <p className={styles.finishStepLabel}>{step.label}</p>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <ul className={styles.finishStepPads}>
              {step.pads.map((pad) => (
                <li key={pad}>{pad}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className={styles.finishAccessory}>
        <strong>{carsystemFinishSystem.accessory.title}</strong>
        <span>{carsystemFinishSystem.accessory.description}</span>
      </div>

      <div className={styles.finishActions}>
        <Link className={styles.secondaryButton} href={carsystemFinishSystem.cta.href}>
          {carsystemFinishSystem.cta.label}
          <span aria-hidden="true">↗</span>
        </Link>
        {brochure ? (
          <a
            className={styles.finishBrochureLink}
            href={brochure.file}
            target="_blank"
            rel="noopener noreferrer"
          >
            Preuzmite Polish X-Serie brošuru
          </a>
        ) : null}
      </div>
    </section>
  );
}
