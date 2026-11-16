"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { SortHeader } from "@/components/portal/SortHeader";
import type { LagerList, LagerRow } from "@/lib/stock/lager-list-service";
import { searchHaystack, searchLager } from "@/lib/stock/lagerSearch.mjs";
import { staleNote, workdaysSince } from "@/lib/stock/stockAge.mjs";
import { nextSort, sortRows } from "@/lib/ui/sortRows.mjs";
import styles from "./LagerLista.module.css";

/**
 * Lager lista (2026-11-16): pretraga radi u pregledaču, na svaki taster, bez odlaska na server.
 * Prikazuje se najviše SHOWN redova — za više se pretraga sužava.
 */

const ALL = "__sve__";
const SHOWN = 200;

type Row = LagerRow & { hay: string };
type SortKey = "artikal" | "sifra" | "stanje" | "cena";
const SORT: Record<SortKey, { value: (r: Row) => string | number | null; first: "asc" | "desc" }> = {
  artikal: { value: (r) => r.name, first: "asc" },
  sifra: { value: (r) => r.code, first: "asc" },
  stanje: { value: (r) => r.stock, first: "desc" },
  cena: { value: (r) => r.price, first: "asc" },
};

const qty = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 3 });
const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.`;
const unitLabel = (u: string | null) => (u ? (u.toUpperCase() === "LIT" ? "L" : u.toLowerCase()) : "");

function stockState(r: LagerRow): "ima" | "nema" | "nepoznato" {
  if (r.stock === null) return "nepoznato";
  return r.stock > 0 ? "ima" : "nema";
}

/** Koliko celih pakovanja čini stanje, kad je pakovanje veće od 1 JM. */
function packsNote(r: LagerRow): string | null {
  if (r.stock === null || r.stock <= 0 || !r.packQuantity || r.packQuantity <= 1) return null;
  const n = Math.floor(r.stock / r.packQuantity + 1e-9);
  return `${n} × ${r.packLabel ?? qty(r.packQuantity)}`;
}

export function LagerTable({ data }: { data: LagerList }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState(ALL);
  const [onlyStock, setOnlyStock] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "artikal", dir: "asc" });
  const deferredQ = useDeferredValue(q);
  const input = useRef<HTMLInputElement>(null);

  // Na računaru je kursor odmah u pretrazi (na telefonu ne — ne otvara tastaturu sam); „/“ vraća fokus u pretragu.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo<Row[]>(() => data.rows.map((r) => ({ ...r, hay: searchHaystack(r) })), [data.rows]);
  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.brand) m.set(r.brand, (m.get(r.brand) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "sr-Latn", { sensitivity: "base" }));
  }, [rows]);

  const found = useMemo(() => {
    const base = rows.filter((r) => (brand === ALL || r.brand === brand) && (!onlyStock || (r.stock !== null && r.stock > 0)));
    const hits = searchLager(base, deferredQ) as Row[];
    // Uz upit, red sa tačnom šifrom ostaje na vrhu dok korisnik ne izabere kolonu.
    return deferredQ.trim() && sort.key === "artikal" && sort.dir === "asc" ? hits : (sortRows(hits, SORT[sort.key].value, sort.dir) as Row[]);
  }, [rows, brand, onlyStock, deferredQ, sort]);

  const stale = data.stockDate ? staleNote(workdaysSince(data.stockDate, data.today)) : null;

  const head = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <SortHeader
      label={label}
      active={sort.key === key}
      dir={sort.dir}
      align={align}
      onClick={() => setSort((cur) => nextSort(cur, key, SORT[key].first) as { key: SortKey; dir: "asc" | "desc" })}
    />
  );

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <label className={`${styles.field} ${styles.grow}`}>
          <span>Pretraga — šifra, naziv ili brend</span>
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="npr. 141453 ili šmirgla 150 p180"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </label>
        <label className={styles.field}>
          <span>Brend</span>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value={ALL}>Svi brendovi</option>
            {brands.map(([b, n]) => (
              <option key={b} value={b}>{b} ({n})</option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
          Samo na stanju
        </label>
      </div>

      <p className={styles.info}>
        {data.stockDate ? (
          <>
            Stanje iz lagera od <b>{dmy(data.stockDate)}</b>
            {stale ? <span className={styles.stale}> ({stale})</span> : null}. Knjižno stanje iz izvoza (021 VELEPRODAJA), u jedinici mere artikla — pre obećanja kupcu proverite sa kancelarijom.
          </>
        ) : (
          <span className={styles.stale}>Lager još nije uvezen — stanje nije poznato.</span>
        )}{" "}
        Cena je osnovna VP cena bez PDV-a, bez rabata kupca.
      </p>

      <div className={styles.tablewrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {head("artikal", "Artikal")}
              {head("sifra", "Šifra")}
              {head("stanje", "Stanje", "right")}
              <th scope="col">Pakovanje</th>
              {head("cena", "VP cena", "right")}
              <th scope="col" style={{ textAlign: "right" }}>U dolasku</th>
            </tr>
          </thead>
          <tbody>
            {found.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>Nijedan artikal ne odgovara pretrazi.</td>
              </tr>
            ) : (
              found.slice(0, SHOWN).map((r) => {
                const s = stockState(r);
                const packs = packsNote(r);
                return (
                  <tr key={r.key}>
                    <td className={styles.article}>
                      <span className={styles.name}>{r.name}</span>
                      {r.newCode ? <span className={styles.tag} title="Šifra je u lageru, ali je još nema u šifarniku portala">nova šifra</span> : null}
                      {r.brand || r.group ? <span className={styles.sub}>{[r.brand, r.group].filter(Boolean).join(" · ")}</span> : null}
                    </td>
                    <td data-label="Šifra" className={styles.code}>{r.code}</td>
                    <td data-label="Stanje" className={styles.num}>
                      <span className={styles.stock} data-s={s}>
                        {s === "nepoznato" ? (r.inSnapshot ? "nejasno" : "nije u lageru") : qty(r.stock as number)}
                      </span>
                      {s !== "nepoznato" && r.unit ? <span className={styles.unit}>{unitLabel(r.unit)}</span> : null}
                      {packs ? <span className={styles.sub}>{packs}</span> : null}
                    </td>
                    <td data-label="Pakovanje">{r.packLabel ?? "—"}</td>
                    <td data-label="VP cena" className={styles.num}>{r.price === null ? "—" : money(r.price)}</td>
                    <td data-label="U dolasku" className={styles.num}>
                      {r.incoming ? (
                        <>
                          {qty(r.incoming.quantity)}
                          {r.unit ? <span className={styles.unit}>{unitLabel(r.unit)}</span> : null}
                          {r.incoming.nearest ? <span className={styles.sub}>oko {dmy(r.incoming.nearest)}</span> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.more} aria-live="polite">
        {found.length > SHOWN
          ? `Prikazano ${SHOWN} od ${found.length} artikala — suzite pretragu.`
          : `${found.length} od ${rows.length} artikala.`}
      </p>
    </section>
  );
}
