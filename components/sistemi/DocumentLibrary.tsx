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

type Group = "" | "tds" | "sds" | "ostalo";

const GROUPS: { id: Exclude<Group, "">; label: string; hint: string }[] = [
  { id: "tds", label: "Tehnički list", hint: "Mešanje, nanošenje, sušenje" },
  { id: "sds", label: "Bezbednosni list", hint: "Opasnosti, rukovanje, zaštitna oprema" },
  { id: "ostalo", label: "Ostali dokumenti", hint: "Uputstva, informacije, izjave, katalozi" },
];

const groupOf = (type: LibraryDocType): Exclude<Group, ""> => (type === "tds" || type === "sds" ? type : "ostalo");

/**
 * Pretraga i filteri biblioteke. Strana stiže sa prvih 24 stavki i brojačima sa servera;
 * ceo spisak se učitava iz `/dokumentacija/podaci.json` (isti izvor), pa filteri, brojači
 * i rezultati uvek računaju nad istim stavkama. Izbor je u adresi (`?q=&vrsta=&brend=`).
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
  const [group, setGroup] = useState<Group>("");
  const [type, setType] = useState<LibraryDocType | "">("");
  const [brand, setBrand] = useState("");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    const vrsta = params.get("vrsta") ?? "";
    if (vrsta === "tds" || vrsta === "sds" || vrsta === "ostalo") setGroup(vrsta);
    else if (vrsta && vrsta in typeLabels) {
      setGroup(groupOf(vrsta as LibraryDocType));
      setType(vrsta as LibraryDocType);
    }
    const b = params.get("brend");
    if (b && brandCounts.some((entry) => entry.slug === b)) setBrand(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- samo pri otvaranju
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (key: string, value: string) => (value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    set("q", query.trim());
    set("vrsta", type || group);
    set("brend", brand);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [query, group, type, brand]);

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
  const matchesBrand = (item: LibraryItem) => !brand || item.brands.some((entry) => entry.slug === brand);
  const matchesType = (item: LibraryItem) => (type ? item.type === type : !group || groupOf(item.type) === group);
  const filtered = useMemo(
    () => (items ?? []).filter((item) => matchesQuery(item) && matchesType(item) && matchesBrand(item)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uslovi su izvedeni iz stanja ispod
    [items, query, group, type, brand],
  );

  // Brojači prate ostale izabrane filtere (isti spisak kao rezultati).
  const counts = useMemo(() => {
    const byGroup = new Map<string, number>();
    const byType = new Map<string, number>();
    const byBrand = new Map<string, number>();
    for (const item of items ?? []) {
      if (!matchesQuery(item)) continue;
      if (matchesBrand(item)) {
        byGroup.set(groupOf(item.type), (byGroup.get(groupOf(item.type)) ?? 0) + 1);
        byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
      }
      if (matchesType(item)) for (const entry of item.brands) byBrand.set(entry.slug, (byBrand.get(entry.slug) ?? 0) + 1);
    }
    return { byGroup, byType, byBrand };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uslovi su izvedeni iz stanja ispod
  }, [items, query, group, type, brand]);

  const ready = items !== null;
  const visible = ready ? filtered.slice(0, shown) : initialItems;
  const total = ready ? filtered.length : typeCounts.reduce((sum, entry) => sum + entry.count, 0);
  const staticGroupCount = (id: Exclude<Group, "">) =>
    typeCounts.filter((entry) => groupOf(entry.type) === id).reduce((sum, entry) => sum + entry.count, 0);
  const otherTypes = typeCounts.filter((entry) => groupOf(entry.type) === "ostalo");
  const active = Boolean(terms.length || group || brand);

  function update(next: () => void) {
    next();
    setShown(PAGE);
  }

  return (
    <div className={styles.filterBar}>
      <div className={styles.libSearchRow}>
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
        <label className={styles.searchField}>
          Brend
          <select disabled={!ready} onChange={(event) => update(() => setBrand(event.target.value))} value={brand}>
            <option value="">Svi brendovi</option>
            {brandCounts.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name} ({ready ? (counts.byBrand.get(entry.slug) ?? 0) : entry.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className={styles.libGroups}>
        <legend className={styles.choiceLegend}>Vrsta dokumenta</legend>
        <button
          aria-pressed={group === ""}
          className={styles.libGroup}
          disabled={!ready}
          onClick={() => update(() => {
            setGroup("");
            setType("");
          })}
          type="button"
        >
          <span className={styles.libGroupLabel}>Svi dokumenti</span>
          <span className={styles.libGroupHint}>Sve vrste</span>
        </button>
        {GROUPS.map((entry) => (
          <button
            aria-pressed={group === entry.id}
            className={styles.libGroup}
            data-type={entry.id}
            disabled={!ready}
            key={entry.id}
            onClick={() => update(() => {
              setGroup(group === entry.id ? "" : entry.id);
              setType("");
            })}
            type="button"
          >
            <span className={styles.libGroupLabel}>
              {entry.label}
              <span className={styles.chipCount}>{ready ? (counts.byGroup.get(entry.id) ?? 0) : staticGroupCount(entry.id)}</span>
            </span>
            <span className={styles.libGroupHint}>{entry.hint}</span>
          </button>
        ))}
      </fieldset>

      {group === "ostalo" && otherTypes.length > 1 ? (
        <fieldset className={styles.chips}>
          <legend className={styles.visuallyHidden}>Ostali dokumenti</legend>
          {otherTypes.map((entry) => (
            <button
              aria-pressed={type === entry.type}
              className={styles.chip}
              disabled={!ready}
              key={entry.type}
              onClick={() => update(() => setType(type === entry.type ? "" : entry.type))}
              type="button"
            >
              {typeLabels[entry.type]}
              <span className={styles.chipCount}>{ready ? (counts.byType.get(entry.type) ?? 0) : entry.count}</span>
            </button>
          ))}
        </fieldset>
      ) : null}

      <div className={styles.libStatusRow}>
        <p aria-live="polite" className={styles.resultStatus} role="status">
          {loadError
            ? "Spisak za pretragu nije učitan. Prikazani su prvi dokumenti; osvežite stranicu za pretragu i filtere."
            : ready
              ? `${documentsLabel(total)}${active ? " za izabrane filtere" : ""}`
              : `${documentsLabel(total)} · učitava se pretraga`}
        </p>
        {active ? (
          <button
            className={styles.gToolbarButton}
            onClick={() => update(() => {
              setQuery("");
              setGroup("");
              setType("");
              setBrand("");
            })}
            type="button"
          >
            Poništite filtere
          </button>
        ) : null}
      </div>

      {ready && filtered.length === 0 ? (
        <div className={styles.notice} data-tone="info">
          <p>Nema dokumenta za ovaj izbor.</p>
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
            <span className={styles.docType} data-type={groupOf(item.type)}>
              {typeLabels[item.type]}
            </span>
            <div className={styles.docMain}>
              <span className={styles.docTitle}>{item.title}</span>
              {item.products.length ? (
                <div className={styles.docMeta}>
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
            </div>
            <span className={styles.docBrand}>{item.brands.map((entry) => entry.name).join(", ")}</span>
            <a className={styles.docOpen} href={item.href} rel="noopener noreferrer" target="_blank">
              {item.viaProductPage ? "Sajt proizvođača" : item.external ? "Otvorite (sajt proizvođača)" : "Otvorite PDF"}
              <span className={styles.visuallyHidden}> — {item.title}</span>
            </a>
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
