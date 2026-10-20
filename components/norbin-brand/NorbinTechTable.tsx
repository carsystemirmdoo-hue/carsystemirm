"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./NorbinBrandPage.module.css";

export type NorbinTechColumn = {
  code: string;
  name: string;
  /** Vrednost po nazivu polja; polje koje list ne navodi nema ključ. */
  values: Record<string, string>;
  tds: { url: string; version: string | null } | null;
};

/*
 * Tehnička tabela sa lepljivim zaglavljem (2026-10-20).
 *
 * Tabela mora da se skroluje horizontalno (telefon, uži ekrani), a omotač sa
 * `overflow-x: auto` postaje kontejner skrola i po vertikali — `position:
 * sticky` na `thead` se tada lepi za omotač, ne za prozor. Zato posle
 * hidratacije iznad tela tabele stoji kopija zaglavlja (`aria-hidden`), koja je
 * lepljiva u odnosu na prozor: odmah ispod globalnog headera i lokalne
 * navigacije (iste promenljive koje piše `BrandSectionNav`). Kopija stoji tačno
 * preko pravog zaglavlja (telo tabele ima negativnu gornju marginu = visina
 * kopije), pa u
 * mirovanju nema razlike; lepi se samo unutar bloka tabele i staje na njenom
 * kraju. Obe tabele imaju `table-layout: fixed` i iste širine kolona, a
 * horizontalni položaj se sinhronizuje u oba smera.
 *
 * Bez JavaScripta (i pre hidratacije) ostaje obična tabela sa pravim
 * zaglavljem — vrednosti i redosled kolona su isti.
 */
export function NorbinTechTable({
  columns,
  fields,
}: {
  columns: NorbinTechColumn[];
  fields: string[];
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!mounted || !body || !head) return;

    // Telo tabele se podvlači pod kopiju za njenu visinu, pa kopija leži tačno
    // preko pravog zaglavlja. Margina ide na telo, ne na kopiju: tako lepljivi
    // okvir kopije ostaje ceo u bloku i staje tačno na kraju tabele.
    const syncHeight = () => {
      body.style.marginTop = `-${head.offsetHeight}px`;
    };
    const syncFromBody = () => {
      if (head.scrollLeft !== body.scrollLeft) head.scrollLeft = body.scrollLeft;
    };
    const syncFromHead = () => {
      if (body.scrollLeft !== head.scrollLeft) body.scrollLeft = head.scrollLeft;
    };

    syncHeight();
    syncFromBody();
    const resize = new ResizeObserver(syncHeight);
    resize.observe(head);
    body.addEventListener("scroll", syncFromBody, { passive: true });
    head.addEventListener("scroll", syncFromHead, { passive: true });
    return () => {
      body.style.marginTop = "";
      resize.disconnect();
      body.removeEventListener("scroll", syncFromBody);
      head.removeEventListener("scroll", syncFromHead);
    };
  }, [mounted]);

  const colgroup = (
    <colgroup>
      <col className={styles.techColLabel} />
      {columns.map((column) => (
        <col key={column.code} />
      ))}
    </colgroup>
  );

  const headRow = (cell: (children: ReactNode, key: string) => ReactNode) => (
    <tr>
      {cell("Podatak", "__label")}
      {columns.map((column) =>
        cell(
          <>
            <strong>{column.code}</strong>
            <span>{column.name}</span>
          </>,
          column.code,
        ),
      )}
    </tr>
  );

  return (
    <div
      className={styles.techTableBlock}
      style={{ "--tech-cols": columns.length } as CSSProperties}
    >
      {mounted ? (
        <div className={styles.techStickyHead} ref={headRef} aria-hidden="true">
          <table className={styles.techMatrix}>
            {colgroup}
            <thead>
              {headRow((children, key) => (
                <th key={key}>{children}</th>
              ))}
            </thead>
          </table>
        </div>
      ) : null}

      <div
        className={styles.techTableWrap}
        ref={bodyRef}
        role="region"
        aria-label="Tabela tehničkih podataka"
        tabIndex={0}
      >
        <table className={styles.techMatrix}>
          {colgroup}
          <thead>
            {headRow((children, key) => (
              <th scope="col" key={key}>
                {children}
              </th>
            ))}
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field}>
                <th scope="row">{field}</th>
                {columns.map((column) => (
                  <td key={column.code}>{column.values[field] ?? "—"}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Izvor</th>
              {columns.map((column) => (
                <td key={column.code}>
                  {column.tds ? (
                    <a href={column.tds.url} target="_blank" rel="noopener noreferrer">
                      TDS {column.tds.version ?? ""} ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
