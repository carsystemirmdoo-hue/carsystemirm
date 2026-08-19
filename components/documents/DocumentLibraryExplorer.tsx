"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DocumentCard, documentBrandLabel } from "@/components/documents/DocumentCard";
import type { BrandDocument } from "@/lib/documents";
import styles from "./DocumentLibraryPage.module.css";

const brandLabel = documentBrandLabel;

export function DocumentLibraryExplorer({ documents }: { documents: BrandDocument[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialBrand = searchParams.get("brend") ?? searchParams.get("brand") ?? "";
  const [selectedBrand, setSelectedBrand] = useState(initialBrand);

  const brandSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const document of documents) {
      for (const brand of document.brands) slugs.add(brand);
    }
    return Array.from(slugs);
  }, [documents]);

  const filtered = useMemo(() => {
    if (!selectedBrand) return documents;
    return documents.filter((document) => document.brands.includes(selectedBrand));
  }, [documents, selectedBrand]);

  const featured = filtered.filter((document) => document.featured);
  const brochures = filtered.filter(
    (document) =>
      !document.featured &&
      (document.type === "family-brochure" ||
        document.type === "product-brochure" ||
        document.type === "campaign"),
  );
  const guides = filtered.filter(
    (document) =>
      !document.featured &&
      (document.type === "technical-guide" || document.type === "process-guide"),
  );

  function selectBrand(brand: string) {
    setSelectedBrand(brand);
    const params = new URLSearchParams(searchParams.toString());
    if (brand) {
      params.set("brand", brand);
    } else {
      params.delete("brand");
    }
    params.delete("brend");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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

            {brandSlugs.length > 0 ? (
              <nav className={styles.filters} aria-label="Filter po brendu">
                <button
                  type="button"
                  className={styles.filterChip}
                  data-active={selectedBrand === "" || undefined}
                  aria-pressed={selectedBrand === ""}
                  onClick={() => selectBrand("")}
                >
                  Sve
                </button>
                {brandSlugs.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className={styles.filterChip}
                    data-active={selectedBrand === brand || undefined}
                    aria-pressed={selectedBrand === brand}
                    onClick={() => selectBrand(brand)}
                  >
                    {brandLabel(brand)}
                  </button>
                ))}
              </nav>
            ) : null}
          </header>

          {filtered.length === 0 ? (
            <p className={styles.emptyState}>
              Za ovaj brend trenutno nemamo javno dostupnu dokumentaciju.
            </p>
          ) : (
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
          )}
      </div>
    </main>
  );
}
