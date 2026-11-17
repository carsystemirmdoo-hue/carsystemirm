"use client";

import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SortHeader } from "@/components/portal/SortHeader";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type { LagerCustomer, LagerCustomerPrice, LagerList, LagerRow } from "@/lib/stock/lager-list-service";
import { searchHaystack, searchLager } from "@/lib/stock/lagerSearch.mjs";
import { staleNote, workdaysSince } from "@/lib/stock/stockAge.mjs";
import { nextSort, sortRows } from "@/lib/ui/sortRows.mjs";
import styles from "./LagerLista.module.css";
import { TrazenoDialog } from "./TrazenoDialog";

/**
 * Lager lista (2026-11-16): pretraga radi u pregledaču, na svaki taster, bez odlaska na server.
 * Prikazuje se najviše SHOWN redova — za više se pretraga sužava.
 */

const ALL = "__sve__";
const SHOWN = 200;

type Row = LagerRow & { hay: string };
type SortKey = "artikal" | "sifra" | "stanje" | "cena" | "kupac";
type Prices = Record<string, LagerCustomerPrice>;
const SORT: Record<SortKey, { value: (r: Row, p: Prices) => string | number | null; first: "asc" | "desc" }> = {
  artikal: { value: (r) => r.name, first: "asc" },
  sifra: { value: (r) => r.code, first: "asc" },
  stanje: { value: (r) => r.stock, first: "desc" },
  cena: { value: (r) => r.price, first: "asc" },
  kupac: { value: (r, p) => (p[r.key]?.status === "cena" ? (p[r.key] as { netCents: number }).netCents : null), first: "asc" },
};
const NO_PRICES: Prices = {};

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

/** Ćelija „Cena za kupca“: neto cena bez PDV-a i rabat, ili zašto cene nema. */
function CustomerPriceCell({ p }: { p: LagerCustomerPrice | undefined }) {
  if (!p) return <>—</>;
  if (p.status === "van_ponude") return <span className={styles.muted}>van ponude</span>;
  if (p.status === "na_upit") return <span className={styles.muted} title={p.message}>na upit</span>;
  return (
    <>
      <span className={styles.customerPrice}>{money(p.netCents / 100)}</span>
      <span className={styles.sub}>{p.fixed ? "dogovorena cena" : p.discountPercent ? `rabat ${qty(p.discountPercent)} %` : "bez rabata"}</span>
    </>
  );
}

export function LagerTable({
  data,
  customers,
  forCustomer,
}: {
  data: LagerList;
  customers: LagerCustomer[];
  forCustomer: { customer: LagerCustomer; prices: Prices } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loadingCustomer, startCustomer] = useTransition();
  const prices = forCustomer?.prices ?? NO_PRICES;
  const chooseCustomer = (id: string) =>
    startCustomer(() => router.replace(id ? `${pathname}?kupac=${encodeURIComponent(id)}` : pathname, { scroll: false }));
  const customerOptions = useMemo(
    () => [
      { value: "", label: "Bez kupca — samo VP cena" },
      ...customers.map((c) => ({ value: c.id, label: c.city ? `${c.name} — ${c.city}` : c.name, keywords: [c.pib] })),
    ],
    [customers],
  );
  const [trazeno, setTrazeno] = useState<LagerRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    // „Ostalo“ (naziv bez prepoznatog brenda) ide na kraj spiska.
    return [...m.entries()].sort((a, b) => Number(a[0] === "Ostalo") - Number(b[0] === "Ostalo") || a[0].localeCompare(b[0], "sr-Latn", { sensitivity: "base" }));
  }, [rows]);

  // Kupac je skinut (ili nije dozvoljen) dok je tabela bila poređana po njegovoj ceni.
  const sortKey: SortKey = sort.key === "kupac" && !forCustomer ? "artikal" : sort.key;
  const found = useMemo(() => {
    const base = rows.filter((r) => (brand === ALL || r.brand === brand) && (!onlyStock || (r.stock !== null && r.stock > 0)));
    const hits = searchLager(base, deferredQ) as Row[];
    // Uz upit, red sa tačnom šifrom ostaje na vrhu dok korisnik ne izabere kolonu.
    return deferredQ.trim() && sortKey === "artikal" && sort.dir === "asc" ? hits : (sortRows(hits, (r: Row) => SORT[sortKey].value(r, prices), sort.dir) as Row[]);
  }, [rows, brand, onlyStock, deferredQ, sortKey, sort.dir, prices]);


  const stale = data.stockDate ? staleNote(workdaysSince(data.stockDate, data.today)) : null;

  const head = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <SortHeader
      label={label}
      active={sortKey === key}
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
        {customers.length ? (
          <div className={`${styles.field} ${styles.customer}`}>
            <span>Cena za kupca{loadingCustomer ? " — učitavam…" : ""}</span>
            <SearchableCombobox
              ariaLabel="Kupac za koga se prikazuje cena"
              value={forCustomer?.customer.id ?? ""}
              options={customerOptions}
              onChange={chooseCustomer}
              placeholder="Izaberite kupca"
              searchPlaceholder="Naziv, mesto ili PIB kupca"
              emptyMessage="Nijedan kupac ne odgovara pretrazi."
              sheetTitle="Cena za kupca"
              disabled={loadingCustomer}
            />
          </div>
        ) : null}
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
        VP cena je osnovna cena bez PDV-a, bez rabata kupca.
        {forCustomer ? (
          <>
            {" "}
            <b>Cena za kupca {forCustomer.customer.name}</b> je njegova neto cena bez PDV-a (VP cena − njegov rabat), po osnovnom uslovu plaćanja — ista koju
            kupac vidi kada je prijavljen.
          </>
        ) : null}
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
              {forCustomer ? head("kupac", "Cena za kupca", "right") : null}
              <th scope="col" style={{ textAlign: "right" }}>U dolasku</th>
              <th scope="col" aria-label="Traženo" />
            </tr>
          </thead>
          <tbody>
            {found.length === 0 ? (
              <tr>
                <td colSpan={forCustomer ? 8 : 7} className={styles.empty}>Nijedan artikal ne odgovara pretrazi.</td>
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
                    {forCustomer ? (
                      <td data-label="Cena za kupca" className={`${styles.num} ${styles.customerCell}`}>
                        <CustomerPriceCell p={prices[r.key]} />
                      </td>
                    ) : null}
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
                    <td className={styles.askCell}>
                      {r.newCode ? null : (
                        <button type="button" className={styles.ask} onClick={() => setTrazeno(r)} title="Kupac je tražio ovaj artikal, a nema ga na stanju">
                          Traženo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {trazeno ? (
        <TrazenoDialog
          row={trazeno}
          customers={customers}
          defaultCustomerId={forCustomer?.customer.id ?? null}
          onClose={() => setTrazeno(null)}
          onDone={(text) => {
            setTrazeno(null);
            setNotice(text);
            router.refresh();
          }}
        />
      ) : null}
      <p className={styles.more} aria-live="polite">
        {found.length > SHOWN
          ? `Prikazano ${SHOWN} od ${found.length} artikala — suzite pretragu.`
          : `${found.length} od ${rows.length} artikala.`}
      </p>
    </section>
  );
}
