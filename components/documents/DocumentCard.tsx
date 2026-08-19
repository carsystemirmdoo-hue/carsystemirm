import Image from "next/image";
import type { BrandDocument, DocumentType } from "@/lib/documents";
import styles from "./DocumentLibraryPage.module.css";

const brandLabels: Record<string, string> = {
  carsystem: "Carsystem",
  rm: "R-M",
  baslac: "baslac",
  norbin: "NORBIN",
  befar: "Befar",
  carfit: "C.A.R.FIT",
  "cosmos-lac": "Cosmos",
};

const typeLabels: Record<DocumentType, string> = {
  catalog: "Katalog",
  "family-brochure": "Brošura sistema",
  "product-brochure": "Brošura proizvoda",
  "technical-guide": "Tehnički vodič",
  "process-guide": "Vodič procesa",
  campaign: "Kampanja",
};

export function documentBrandLabel(slug: string) {
  return brandLabels[slug] ?? slug;
}

export function DocumentCard({ document }: { document: BrandDocument }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardCover}>
        {document.cover ? (
          <Image
            src={document.cover}
            alt={`Naslovna strana — ${document.title}`}
            width={520}
            height={693}
            sizes="(min-width: 1024px) 260px, 45vw"
          />
        ) : (
          <div className={styles.cardCoverPlaceholder}>
            <span className={styles.cardCoverMark} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span>{documentBrandLabel(document.brands[0])}</span>
          <span>{typeLabels[document.type]}</span>
          {document.year ? <span>{document.year}</span> : null}
          {document.pages ? <span>{document.pages} str.</span> : null}
          {document.languages?.length ? (
            <span>{document.languages.join("/").toUpperCase()}</span>
          ) : null}
        </div>
        <h3 className={styles.cardTitle}>{document.title}</h3>
        {document.description ? (
          <p className={styles.cardDescription}>{document.description}</p>
        ) : null}
        <div className={styles.cardActions}>
          <a
            className={`${styles.cardAction} ${styles.cardActionSecondary}`}
            href={document.file}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Pregledaj PDF — ${document.title}`}
          >
            Pregledaj PDF
          </a>
          <a
            className={`${styles.cardAction} ${styles.cardActionPrimary}`}
            href={document.file}
            download
            aria-label={`Preuzmi PDF — ${document.title}`}
          >
            Preuzmi
          </a>
        </div>
      </div>
    </article>
  );
}
