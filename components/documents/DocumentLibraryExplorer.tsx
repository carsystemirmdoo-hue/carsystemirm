"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { documentBrandLabel } from "@/components/documents/DocumentCard";
import { DocumentLibrarySections } from "@/components/documents/DocumentLibrarySections";
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

  function selectBrand(brand: string) {
    setSelectedBrand(brand);
    const params = new URLSearchParams(searchParams.toString());
    // Kanonski parametar je `brend`; stari `brand` se samo čita (alias).
    if (brand) {
      params.set("brend", brand);
    } else {
      params.delete("brend");
    }
    params.delete("brand");
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
              za brendove iz naše ponude.
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

          <DocumentLibrarySections documents={filtered} />
      </div>
    </main>
  );
}
