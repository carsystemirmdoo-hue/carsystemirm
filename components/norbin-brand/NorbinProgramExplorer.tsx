"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./NorbinBrandPage.styles";

export type NorbinProgramItem = {
  slug: string;
  code: string;
  name: string;
  packages: string[];
  href: string;
  /** Samo odobrena slika (runtime već krije slike bez potvrđenih prava). */
  image: { src: string; alt: string } | null;
};

/*
 * „Naš program“ (2026-10-19): prelazak mišem, fokus tastature ili dodir na red
 * prikazuje taj proizvod u desnom panelu. Izbor je sinhrono stanje, pa brzo
 * menjanje ne može da ostavi zastareo prikaz. Slike odobrenih proizvoda su u
 * panelu samo jednom (slojevi, prikazuje se izabrani) — ponovni prelazak ne
 * učitava sliku iznova. Panel ima fiksnu visinu, pa se raspored ne pomera.
 */
export function NorbinProgramExplorer({ items }: { items: NorbinProgramItem[] }) {
  const [selectedSlug, setSelectedSlug] = useState(items[0]?.slug ?? "");
  const selected = items.find((item) => item.slug === selectedSlug) ?? items[0];
  const pictured = useMemo(() => items.filter((item) => item.image), [items]);

  if (!selected) return null;

  return (
    <div className={styles.programLayout}>
      <ul className={styles.stockedList} aria-label="Norbin program">
        {items.map((item) => {
          const active = item.slug === selected.slug;
          return (
            <li key={item.slug}>
              <button
                type="button"
                aria-pressed={active}
                aria-controls="norbin-program-preview"
                data-active={active || undefined}
                onMouseEnter={() => setSelectedSlug(item.slug)}
                onFocus={() => setSelectedSlug(item.slug)}
                onClick={() => setSelectedSlug(item.slug)}
              >
                <strong>{item.code}</strong>
                <span>{item.name}</span>
                <small>{item.packages[0] ?? ""}</small>
              </button>
            </li>
          );
        })}
      </ul>

      <aside
        id="norbin-program-preview"
        className={styles.systemPanel}
        aria-live="polite"
        aria-label="Izabrani Norbin proizvod"
      >
        <div className={styles.previewMedia}>
          {pictured.map((item) => (
            <Image
              key={item.slug}
              src={item.image!.src}
              alt={item.slug === selected.slug ? item.image!.alt : ""}
              fill
              sizes="(min-width: 64rem) 24rem, 80vw"
              data-visible={item.slug === selected.slug || undefined}
            />
          ))}
          {!selected.image ? (
            <div className={styles.previewNoImage}>
              <strong>{selected.code}</strong>
              <span>Fotografija nije dostupna.</span>
            </div>
          ) : null}
        </div>

        <div className={styles.previewCopy}>
          <p className={styles.previewCode}>{selected.code}</p>
          <p className={styles.previewName}>{selected.name}</p>
          {selected.packages.length > 0 ? (
            <p className={styles.previewPackages}>
              Pakovanje: {selected.packages.join(" · ")}
            </p>
          ) : null}
          <Link className={styles.buttonText} href={selected.href}>
            Otvorite proizvod →
          </Link>
        </div>

        <p className={styles.previewNote}>
          Program ima 13 proizvoda u pet familija odnosa mešanja; dostupnost
          artikala van trenutne ponude proveravamo na upit.{" "}
          <Link href="/kontakt?tema=proizvod&brend=norbin">Pošaljite upit →</Link>
        </p>
      </aside>
    </div>
  );
}
