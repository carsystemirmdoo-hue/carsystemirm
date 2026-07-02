import Link from "next/link";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import styles from "./ProductDetailPage.module.css";

export function ProductDocuments({ product }: { product: CarsystemProduct }) {
  if (product.documents.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="product-documents-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Dokumentacija</p>
        <h2 id="product-documents-title" className={styles.sectionTitle}>
          Tehnička dokumenta
        </h2>
        <p className={styles.sectionText}>
          Tehnički i bezbednosni dokumenti se potvrđuju kroz upit. Redovi daju
          jasan pregled šta je dostupno sada, a šta se priprema za katalog.
        </p>
      </div>

      <div className={styles.documentList}>
        {product.documents.map((document) => {
          const isDownloadable = document.status === "available" && Boolean(document.href);
          const isDisabled = document.status === "disabled";
          const availability = isDownloadable
            ? "Dostupno"
            : isDisabled
              ? "U pripremi"
              : "Dostupno na upit";

          return (
            <article
              className={`${styles.documentRow} ${isDisabled ? styles.documentDisabled : ""}`}
              key={document.title}
            >
              <span className={styles.documentKind}>{getDocumentKind(document.title, document.kind)}</span>
              <div className={styles.documentCopy}>
                <h3 className={styles.documentTitle}>{document.title}</h3>
                {document.note && <p className={styles.documentNote}>{document.note}</p>}
              </div>
              <span className={styles.documentStatus}>{availability}</span>
              {isDownloadable ? (
                <a
                  className={styles.documentAction}
                  href={document.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Otvori dokument
                </a>
              ) : isDisabled ? (
                <span className={styles.documentActionDisabled}>Nije javno</span>
              ) : (
                <Link
                  className={styles.documentAction}
                  href={`/kontakt?tema=dokument&proizvod=${product.slug}`}
                >
                  Zatraži dokument
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getDocumentKind(title: string, fallback: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("tehnički")) return "TDS";
  if (normalized.includes("bezbednosni")) return "SDS";
  if (normalized.includes("uputstvo")) return "Uputstvo";

  return fallback;
}
