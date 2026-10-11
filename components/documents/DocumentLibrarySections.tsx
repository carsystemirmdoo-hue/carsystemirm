import { DocumentCard } from "@/components/documents/DocumentCard";
import type { BrandDocument } from "@/lib/documents";
import styles from "./DocumentLibraryPage.module.css";

/**
 * Spisak dokumenata po grupama, bez stanja i hook-ova.
 *
 * Koristi ga i klijentski filter (`DocumentLibraryExplorer`) i serverski fallback
 * (`DocumentLibraryPage`): bez toga je statički HTML `/katalozi` imao samo naslov, a nijedan
 * katalog — pretraživač i posetilac bez JavaScript-a nisu videli nijedan dokument.
 */
export function DocumentLibrarySections({ documents }: { documents: BrandDocument[] }) {
  const featured = documents.filter((document) => document.featured);
  const brochures = documents.filter(
    (document) =>
      !document.featured &&
      (document.type === "family-brochure" ||
        document.type === "product-brochure" ||
        document.type === "campaign"),
  );
  const guides = documents.filter(
    (document) =>
      !document.featured &&
      (document.type === "technical-guide" || document.type === "process-guide"),
  );

  if (documents.length === 0) {
    return (
      <p className={styles.emptyState}>
        Za ovaj brend trenutno nemamo javno dostupnu dokumentaciju.
      </p>
    );
  }

  return (
    <>
      {featured.length > 0 ? (
        <section className={styles.section} aria-labelledby="katalozi-featured-heading">
          <h2 id="katalozi-featured-heading" className={styles.sectionHeading}>
            Kompletni katalozi
          </h2>
          <div className={styles.grid} data-density="featured">
            {featured.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </section>
      ) : null}

      {brochures.length > 0 ? (
        <section className={styles.section} aria-labelledby="katalozi-brochures-heading">
          <h2 id="katalozi-brochures-heading" className={styles.sectionHeading}>
            Programske i produktne brošure
          </h2>
          <div className={styles.grid}>
            {brochures.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </section>
      ) : null}

      {guides.length > 0 ? (
        <section className={styles.section} aria-labelledby="katalozi-guides-heading">
          <h2 id="katalozi-guides-heading" className={styles.sectionHeading}>
            Vodiči i tehnički materijali
          </h2>
          <div className={styles.grid}>
            {guides.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
