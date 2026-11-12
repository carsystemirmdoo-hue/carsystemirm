"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ProposedLine } from "@/lib/procurement/incoming-service";
import { leadFor, leadLabel, stavki, SUPPLIERS } from "@/lib/procurement/incoming.mjs";
import { createOrderAction, previewOrderAction, searchArticlesAction } from "./actions";
import styles from "./Porudzbine.module.css";

/**
 * Nova porudžbina dobavljaču (2026-11-12): potvrda iz Excela ili ručni unos (npr. Carsystem šalje
 * skeniran PDF). Rok se predlaže po dobavljaču i može se promeniti; šifre dobavljača se povezuju sa
 * našim artiklima i pamte za sledeći put.
 */

type Article = { id: string; code: string; name: string; unit: string | null };
type Line = {
  key: string;
  supplierCode: string | null;
  supplierName: string;
  quantity: string;
  unit: string | null;
  article: Article | null;
  how: "zapamceno" | "sifra" | "naziv" | "rucno" | null;
  candidates: (Article & { score: number })[];
  include: boolean;
};

const HOW: Record<string, string> = { zapamceno: "zapamćeno", sifra: "ista šifra", naziv: "po nazivu", rucno: "izabrano" };
const qtyOf = (s: string) => {
  const v = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
};

function ArticleSearch({ onPick, placeholder }: { onPick: (a: Article) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Article[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (q.trim().length < 2) {
      setRes([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await searchArticlesAction(q);
      if (n === seq.current) {
        setRes(r);
        setOpen(true);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className={styles.search}>
      <input className={styles.pick} value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && res.length ? (
        <div className={styles.results} role="listbox">
          {res.map((a) => (
            <button
              key={a.id}
              type="button"
              className={styles.result}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(a);
                setQ("");
                setRes([]);
                setOpen(false);
              }}
            >
              <span className={styles.code}>{a.code}</span> {a.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NewOrder({ today }: { today: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"excel" | "rucno" | null>(null);
  const [supplier, setSupplier] = useState("");
  const [orderedOn, setOrderedOn] = useState(today);
  const [leadMin, setLeadMin] = useState("");
  const [leadMax, setLeadMax] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [grid, setGrid] = useState<(string | number | null)[][] | null>(null);
  const [cols, setCols] = useState<{ code?: number; name?: number; qty?: number; unit?: number }>({});
  const [headerRow, setHeaderRow] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pickSupplier = (s: string) => {
    setSupplier(s);
    const l = leadFor(s);
    setLeadMin(String(l.min));
    setLeadMax(String(l.max));
  };
  const reset = () => {
    setMode(null);
    setLines([]);
    setGrid(null);
    setFile(null);
    setCols({});
    setReference("");
    setNote("");
    setOrderedOn(today);
  };

  const read = (manual?: boolean) =>
    start(async () => {
      setMsg(null);
      if (!file || !supplier) {
        setMsg({ ok: false, text: "Izaberite dobavljača i fajl." });
        return;
      }
      const fd = new FormData();
      fd.set("fajl", file);
      fd.set("dobavljac", supplier);
      if (manual) fd.set("kolone", JSON.stringify({ columns: cols, headerRow }));
      const r = await previewOrderAction(fd);
      if (!r.ok) {
        setMsg({ ok: false, text: r.text });
        if (r.needColumns && r.grid) setGrid(r.grid);
        setLines([]);
        return;
      }
      setGrid(null);
      setLines(
        r.lines.map((l: ProposedLine, i: number) => ({
          key: `${i}`,
          supplierCode: l.supplierCode,
          supplierName: l.supplierName,
          quantity: String(l.quantity),
          unit: l.unit,
          article: l.match ? { id: l.match.id, code: l.match.code, name: l.match.name, unit: l.match.unit } : null,
          how: l.match?.how ?? null,
          candidates: l.candidates,
          include: true,
        })),
      );
      setMsg({ ok: true, text: `Pročitano ${stavki(r.lines.length)}${r.skipped ? ` (${r.skipped} redova bez količine preskočeno)` : ""}. Proverite povezane artikle i sačuvajte.` });
    });

  const save = () =>
    start(async () => {
      setMsg(null);
      const chosen = lines.filter((l) => l.include);
      const bad = chosen.find((l) => qtyOf(l.quantity) === null);
      if (bad) {
        setMsg({ ok: false, text: `Neispravna količina: ${bad.supplierName || bad.supplierCode}.` });
        return;
      }
      const r = await createOrderAction({
        supplier,
        reference: reference.trim() || null,
        orderedOn,
        leadMin: Number(leadMin),
        leadMax: Number(leadMax),
        source: mode === "excel" ? "excel" : "rucno",
        fileName: mode === "excel" ? (file?.name ?? null) : null,
        note: note.trim() || null,
        lines: chosen.map((l) => ({
          supplierCode: l.supplierCode,
          supplierName: l.supplierName || l.article?.name || "",
          quantity: qtyOf(l.quantity)!,
          unit: l.unit ?? l.article?.unit ?? null,
          articleId: l.article?.id ?? null,
          // Pamti se samo veza koju je čovek video: predlog po nazivu, ručni izbor ili ista šifra.
          remember: Boolean(l.article && l.supplierCode && l.how !== "zapamceno"),
        })),
      });
      setMsg({ ok: r.ok, text: r.text });
      if (r.ok) {
        reset();
        router.refresh();
      }
    });

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const lead = supplier ? leadFor(supplier) : null;
  const unlinked = lines.filter((l) => l.include && !l.article).length;
  const included = lines.filter((l) => l.include).length;

  if (!mode) {
    return (
      <div className={styles.panel}>
        <div className={styles.head}>
          <h2>Nova porudžbina dobavljaču</h2>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => setMode("excel")}>
              Otpremi potvrdu (Excel)
            </button>
            <button type="button" className={styles.button} onClick={() => setMode("rucno")}>
              Ručni unos
            </button>
          </div>
        </div>
        <p className={styles.hint}>
          Kada dobavljač potvrdi porudžbinu, otpremite njegov Excel. Ako je potvrda PDF ili skenirana (npr. Carsystem), izaberite <b>Ručni unos</b>. Iz
          ekrana <b>Nabavka</b> porudžbina se upisuje ovde jednim klikom posle preuzimanja fajla za dobavljača.
        </p>
        {msg ? (
          <p className={styles.hint}>
            <span className={styles.msg} data-ok={msg.ok}>{msg.text}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2>{mode === "excel" ? "Potvrda porudžbine iz Excela" : "Ručni unos porudžbine"}</h2>
        <button type="button" className={styles.button} onClick={reset} disabled={pending}>
          Odustani
        </button>
      </div>
      <div className={styles.form}>
        <label className={styles.field}>
          Dobavljač
          <select value={supplier} onChange={(e) => pickSupplier(e.target.value)}>
            <option value="">— izaberite —</option>
            {SUPPLIERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Poručeno
          <input type="date" value={orderedOn} max={today} onChange={(e) => setOrderedOn(e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.small}`}>
          Stiže za (od)
          <input type="number" min={0} max={365} value={leadMin} onChange={(e) => setLeadMin(e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.small}`}>
          do (dana)
          <input type="number" min={0} max={365} value={leadMax} onChange={(e) => setLeadMax(e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.grow}`}>
          Broj potvrde / napomena dobavljača
          <input value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} placeholder="npr. AB-2026-4711" />
        </label>
        {mode === "excel" ? (
          <label className={styles.field}>
            Fajl potvrde
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        ) : null}
        {mode === "excel" ? (
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending || !file || !supplier} onClick={() => read(false)}>
            {pending ? "Čitam…" : "Pročitaj"}
          </button>
        ) : null}
      </div>
      {lead ? (
        <p className={styles.hint}>
          Uobičajen rok za {supplier}: <b>{leadLabel(lead.min, lead.max)}</b>. {lead.note ? <span className={styles.note}>{lead.note}</span> : null}
        </p>
      ) : null}

      {grid ? (
        <div>
          <p className={styles.hint}>
            Kolone nisu prepoznate po nazivu. Ispod svake kolone izaberite šta je u njoj (dovoljni su <b>količina</b> i <b>šifra</b> ili <b>naziv</b>), a
            kliknite red koji je zaglavlje (plavo).
          </p>
          <div className={styles.grid}>
            <table>
              <thead>
                <tr>
                  {Array.from({ length: Math.max(...grid.map((r) => r.length), 1) }, (_, c) => {
                    const cur = (Object.entries(cols).find(([, v]) => v === c)?.[0] ?? "") as string;
                    return (
                      <th key={c}>
                        <select
                          value={cur}
                          onChange={(e) => {
                            const k = e.target.value as keyof typeof cols | "";
                            setCols((old) => {
                              const next = Object.fromEntries(Object.entries(old).filter(([, v]) => v !== c)) as typeof cols;
                              if (k) next[k] = c;
                              return next;
                            });
                          }}
                        >
                          <option value="">—</option>
                          <option value="code">šifra</option>
                          <option value="name">naziv</option>
                          <option value="qty">količina</option>
                          <option value="unit">JM</option>
                        </select>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grid.slice(0, 20).map((r, i) => (
                  <tr key={i} className={i === headerRow ? styles.hdr : undefined} onClick={() => setHeaderRow(i)}>
                    {r.map((c, j) => (
                      <td key={j}>{c === null ? "" : String(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.foot}>
            <span />
            <button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending} onClick={() => read(true)}>
              Pročitaj sa ovim kolonama
            </button>
          </div>
        </div>
      ) : null}

      {mode === "rucno" || lines.length ? (
        <div className={styles.tablewrap}>
          <table className={styles.table} data-sort="off">
            <thead>
              <tr>
                <th scope="col" style={{ width: 28 }} aria-label="Uključeno" />
                <th scope="col">Stavka dobavljača</th>
                <th scope="col">Naš artikal</th>
                <th scope="col" className={styles.num}>Količina</th>
                <th scope="col" aria-label="Ukloni" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className={l.include ? undefined : styles.done}>
                  <td>
                    <input type="checkbox" checked={l.include} onChange={(e) => update(l.key, { include: e.target.checked })} aria-label="Uključi stavku" />
                  </td>
                  <td>
                    {l.supplierCode ? <span className={styles.code}>{l.supplierCode}</span> : null} {l.supplierName}
                  </td>
                  <td>
                    {l.article ? (
                      <>
                        <span className={styles.code}>{l.article.code}</span> {l.article.name}
                        <span className={styles.sub}>
                          {HOW[l.how ?? "rucno"]} ·{" "}
                          <button type="button" className={`${styles.button} ${styles.mini}`} onClick={() => update(l.key, { article: null, how: null })}>
                            promeni
                          </button>
                        </span>
                      </>
                    ) : (
                      <>
                        {l.candidates.length ? (
                          <select
                            className={styles.pick}
                            value=""
                            onChange={(e) => {
                              const c = l.candidates.find((x) => x.id === e.target.value);
                              if (c) update(l.key, { article: c, how: "naziv" });
                            }}
                          >
                            <option value="">Izaberite predlog ({l.candidates.length})…</option>
                            {l.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} — {c.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <ArticleSearch placeholder="Traži našu šifru ili naziv…" onPick={(a) => update(l.key, { article: a, how: "rucno" })} />
                      </>
                    )}
                  </td>
                  <td className={styles.num}>
                    <input className={styles.qty} inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} aria-label="Količina" />
                    <span className={styles.sub}>{l.unit ?? l.article?.unit ?? ""}</span>
                  </td>
                  <td>
                    <button type="button" className={`${styles.button} ${styles.mini}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {mode === "rucno" ? (
                <tr>
                  <td />
                  <td colSpan={4}>
                    <ArticleSearch
                      placeholder="Dodaj artikal: naša šifra ili deo naziva…"
                      onPick={(a) =>
                        setLines((ls) => [
                          ...ls,
                          { key: `r${Date.now()}`, supplierCode: null, supplierName: a.name, quantity: "", unit: a.unit, article: a, how: "rucno", candidates: [], include: true },
                        ])
                      }
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={styles.form}>
        <label className={`${styles.field} ${styles.grow}`}>
          Napomena (samo za nas)
          <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className={styles.foot}>
        <span className={styles.msg} data-ok={msg ? msg.ok : undefined}>
          {msg?.text ??
            (included
              ? `${stavki(included)}${unlinked ? ` · ${unlinked} nije povezano sa našim artiklom (može i kasnije, ali tada se dolazak ne prepoznaje sam)` : ""}`
              : "")}
        </span>
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={pending || !included || !supplier || leadMax === ""} onClick={save}>
          {pending ? "Čuvam…" : "Sačuvaj porudžbinu"}
        </button>
      </div>
    </div>
  );
}
