"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LibraryDocType, LibraryItem } from "@/lib/sistemi/document-library";
import styles from "./Sistemi.styles";

const PAGE = 24;

/** 1 dokument, 2–4 dokumenta, 5+ dokumenata (11–14 dokumenata). */
function documentsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} dokument`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} dokumenta`;
  return `${count} dokumenata`;
}

/**
 * Pretraga i filteri biblioteke. Strana stiže sa prvih 24 stavki i brojačima sa servera;
 * ceo spisak se učitava iz `/dokumentacija/podaci.json` (isti izvor), pa filteri, brojači
 * i rezultati uvek računaju nad istim stavkama.
 */
export function DocumentLibrary({
  initialItems,
  typeLabels,
  typeCounts,
  brandCounts,
}: {
  initialItems: LibraryItem[];
  typeLabels: Record<LibraryDocType, string>;
  typeCounts: { type: LibraryDocType; count: number }[];
  brandCounts: { slug: string; name: string; count: number }[];
}) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<LibraryDocType | "">("");
  const [brand, setBrand] = useState("");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let active = true;
    fetch("/dokumentacija/podaci.json")
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<LibraryItem[]>;
      })
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matchesQuery = (item: LibraryItem) => terms.every((term) => item.search.includes(term));
  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (item) => matchesQuery(item) && (!type || item.type === type) && (!brand || item.brands.some((entry) => entry.slug === brand)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- terms je izveden iz query
    [items, query, type, brand],
  );

  // Brojači na čipovima prate ostale izabrane filtere (isti spisak kao rezultati).
  const liveTypeCounts = useMemo(() => {
    if (!items) return null;
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!matchesQuery(item) || (brand && !item.brands.some((entry) => entry.slug === brand))) continue;
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- terms je izveden iz query
  }, [items, query, brand]);
  const liveBrandCounts = useMemo(() => {
    if (!items) return null;
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!matchesQuery(item) || (type && item.type !== type)) continue;
      for (const entry of item.brands) counts.set(entry.slug, (counts.get(entry.slug) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- terms je izveden iz query
  }, [items, query, type]);

  const ready = items !== null;
  const visible = ready ? filtered.slice(0, shown) : initialItems;
  const total = ready ? filtered.length : typeCounts.reduce((sum, entry) => sum + entry.count, 0);

  function update(next: () => void) {
    next();
    setShown(PAGE);
  }

  return (
    <div className={styles.filterBar}>
      <label className={styles.searchField}>
        Naziv proizvoda, šifra ili brend
        <input
          disabled={!ready}
          onChange={(event) => update(() => setQuery(event.target.value))}
          placeholder={ready ? "Na primer: 2A41, Control-Spray, baslac" : "Učitava se spisak dokumenata…"}
          type="search"
          value={query}
        />
      </label>

      <fieldset className={styles.chips}>
        <legend className={styles.choiceLegend}>Vrsta dokumenta</legend>
        <button aria-pressed={type === ""} className={styles.chip} disabled={!ready} onClick={() => update(() => setType(""))} type="button">
          Sve
        </button>
        {typeCounts.map((entry) => (
          <button
            aria-pressed={type === entry.type}
            className={styles.chip}
            disabled={!ready}
            key={entry.type}
            onClick={() => update(() => setType(type === entry.type ? "" : entry.type))}
            type="button"
          >
            {typeLabels[entry.type]}
            <span className={styles.chipCount}>{liveTypeCounts ? (liveTypeCounts.get(entry.type) ?? 0) : entry.count}</span>
          </button>
        ))}
      </fieldset>

      <fieldset className={styles.chips}>
        <legend className={styles.choiceLegend}>Brend</legend>
        <button aria-pressed={brand === ""} className={styles.chip} disabled={!ready} onClick={() => update(() => setBrand(""))} type="button">
          Svi
        </button>
        {brandCounts.map((entry) => (
          <button
            aria-pressed={brand === entry.slug}
            className={styles.chip}
            disabled={!ready}
            key={entry.slug}
            onClick={() => update(() => setBrand(brand === entry.slug ? "" : entry.slug))}
            type="button"
          >
            {entry.name}
            <span className={styles.chipCount}>{liveBrandCounts ? (liveBrandCounts.get(entry.slug) ?? 0) : entry.count}</span>
          </button>
        ))}
      </fieldset>

      <p aria-live="polite" className={styles.resultStatus} role="status">
        {loadError
          ? "Spisak za pretragu nije učitan. Prikazani su prvi dokumenti; osvežite stranicu za pretragu i filtere."
          : ready
            ? `${documentsLabel(total)}${terms.length || type || brand ? " za izabrane filtere" : ""}`
            : `${documentsLabel(total)} · učitava se pretraga`}
      </p>

      {ready && filtered.length === 0 ? (
        <div className={styles.notice} data-tone="info">
          <p>Nema dokumenta za ovaj izbor. Ako tražite list za konkretan proizvod, pošaljite zahtev ispod.</p>
          <p>
            <a className={styles.textLink} href="#zahtev">
              Zatražite dokument
            </a>
          </p>
        </div>
      ) : null}

      <ul className={styles.docList}>
        {visible.map((item) => (
          <li className={styles.docItem} key={item.id}>
            <div className={styles.docHead}>
              <span className={styles.docType}>{typeLabels[item.type]}</span>
              <span className={styles.docMeta}>{item.brands.map((entry) => entry.name).join(", ")}</span>
            </div>
            <span className={styles.docTitle}>{item.title}</span>
            <div className={styles.docLinks}>
              <a href={item.href} rel="noopener noreferrer" target="_blank">
                {item.viaProductPage
                  ? "Dokumentacija na sajtu proizvođača"
                  : item.external
                    ? "Otvorite dokument na sajtu proizvođača"
                    : "Otvorite dokument (PDF)"}
                <span className={styles.visuallyHidden}> — {item.title}</span>
              </a>
            </div>
            {item.products.length ? (
              <div className={styles.docMeta}>
                {item.productCount === 1 ? "Proizvod: " : `Proizvodi (${item.productCount}): `}
                {item.products.map((product, index) => (
                  <span key={product.href}>
                    {index > 0 ? ", " : ""}
                    <Link className={styles.textLink} href={product.href}>
                      {product.name}
                    </Link>
                  </span>
                ))}
                {item.productCount > item.products.length ? ` i još ${item.productCount - item.products.length}` : ""}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {ready && filtered.length > shown ? (
        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={() => setShown((current) => current + PAGE)} type="button">
            Prikažite još ({filtered.length - shown})
          </button>
        </div>
      ) : null}
    </div>
  );
}
