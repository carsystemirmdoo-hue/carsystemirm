import { Suspense } from "react";
import { DocumentLibraryExplorer } from "@/components/documents/DocumentLibraryExplorer";
import { Footer } from "@/components/layout/Footer";
import type { BrandDocument } from "@/lib/documents";
import styles from "./DocumentLibraryPage.module.css";

/**
 * Server-renderovano zaglavlje biblioteke dokumenata.
 *
 * `DocumentLibraryExplorer` je klijentska komponenta koja čita `useSearchParams`,
 * pa Next njen podstablo izostavlja iz statičkog HTML-a i renderuje samo
 * Suspense fallback. Dok je fallback bio `null`, izgrađena `/katalozi` stranica
 * nije imala nijedan H1 — jedini naslovi u HTML-u bili su h2 iz futera.
 *
 * Fallback zato nosi isti hero i iste CSS klase kao eksplorer: vizuelna
 * hijerarhija se ne menja, a puzač dobija jedan semantički H1. Posle hidracije
 * eksplorer renderuje svoj hero na istom mestu, pa u DOM-u i dalje postoji
 * tačno jedan H1.
 */
function DocumentLibraryHero() {
  return (
    <main className="ds-container">
      <div className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Dokumentacija</p>
          <h1 className={styles.title}>Katalozi i dokumentacija</h1>
          <p className={styles.lead}>
            Zvanični proizvođački katalozi, brošure proizvodnih sistema i tehnički vodiči
            dostupni kroz brendove koje zastupamo.
          </p>
        </header>
      </div>
    </main>
  );
}

export function DocumentLibraryPage({ documents }: { documents: BrandDocument[] }) {
  return (
    <>
      <Suspense fallback={<DocumentLibraryHero />}>
        <DocumentLibraryExplorer documents={documents} />
      </Suspense>
      <Footer />
    </>
  );
}
