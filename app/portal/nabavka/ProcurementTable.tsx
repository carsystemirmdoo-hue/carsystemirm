"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SortHeader } from "@/components/portal/SortHeader";
import type { ProcurementData, ProcurementRow } from "@/lib/procurement/procurement-service";
import { parseOrderQuantity } from "@/lib/procurement/suggest.mjs";
import { staleNote, workdaysSince } from "@/lib/stock/stockAge.mjs";
import { nextSort, sortRows } from "@/lib/ui/sortRows.mjs";
import { orderFileAction } from "./actions";
import styles from "./Nabavka.module.css";

/**
 * Tabela nabavke (2026-11-10). Upisane količine čuvaju se u ovom pregledaču dok se fajl ne
 * preuzme (i posle, dok ih vlasnik ne obriše) — promena brenda ili osvežavanje ih ne briše.
 */

const DRAFT_KEY = "carsystem:nabavka:porucujem:v1";
const ALL = "__sve__";

type SortKey = "artikal" | "prodato30" | "prodato" | "lager" | "predlog" | "porucujem";
const SORT: Record<SortKey, { value: (r: ProcurementRow, q: Record<string, string>) => string | number | null; first: "asc" | "desc" }> = {
  artikal: { value: (r) => r.name, first: "asc" },
  prodato30: { value: (r) => r.sold30, first: "desc" },
  prodato: { value: (r) => r.sold180, first: "desc" },
  lager: { value: (r) => r.stock, first: "asc" },
  predlog: { value: (r) => r.suggested, first: "desc" },
  porucujem: { value: (r, q) => parseOrderQuantity(q[r.code] ?? "") ?? -1, first: "desc" },
};

const fmt = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 3 });
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
/** Srpska množina: 1 stavka, 2–4 stavke, 5+ stavki (11–14 stavki). */
const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const dd = n % 100;
  return d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
};
const TREND: Record<string, string> = { raste: "raste", pada: "pada", novo: "novo" };

function readDraft(): Record<string, string> {
  try {
    const v = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}");
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function ProcurementTable({
  data,
  historyDays,
  coverChoices,
  canExport,
}: {
  data: ProcurementData;
  historyDays: number;
  coverChoices: number[];
  canExport: boolean;
}) {
  const router = useRouter();
  const [brand, setBrand] = useState(data.brands[0]?.name ?? ALL);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "predlog", dir: "desc" });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [navigating, startNav] = useTransition();

  useEffect(() => {
    setDraft(readDraft());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* privatni prozor: upis se ne pamti, ekran radi */
    }
  }, [draft, loaded]);

  const stale = data.stockDate ? staleNote(workdaysSince(data.stockDate, data.today)) : null;
  const inBrand = useMemo(() => (brand === ALL ? data.rows : data.rows.filter((r) => r.brand === brand)), [data.rows, brand]);
  const visible = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("sr-Latn");
    const list = inBrand.filter((r) => {
      if (t && !`${r.name} ${r.code}`.toLocaleLowerCase("sr-Latn").includes(t)) return false;
      if (onlyActive && !t && !(r.sold180 > 0 || r.suggested > 0 || r.isNew || (draft[r.code] ?? "").trim())) return false;
      return true;
    });
    return sortRows(list, (r: ProcurementRow) => SORT[sort.key].value(r, draft), sort.dir) as ProcurementRow[];
  }, [inBrand, q, onlyActive, sort, draft]);

  const entered = inBrand
    .map((r) => ({ r, v: parseOrderQuantity(draft[r.code] ?? "") }))
    .filter((x): x is { r: ProcurementRow; v: number } => x.v !== null && !Number.isNaN(x.v) && x.v > 0);
  const invalid = inBrand.filter((r) => Number.isNaN(parseOrderQuantity(draft[r.code] ?? ""))).length;
  const label = brand === ALL ? "Više brendova" : brand;

  const head = (key: SortKey, text: string, align: "left" | "right" = "left") => (
    <SortHeader
      label={text}
      active={sort.key === key}
      dir={sort.dir}
      align={align}
      className={align === "right" ? styles.num : undefined}
      onClick={() => setSort((cur) => nextSort(cur, key, SORT[key].first) as { key: SortKey; dir: "asc" | "desc" })}
    />
  );

  const setQty = (code: string, value: string) => {
    setMsg(null);
    setDraft((d) => {
      const next = { ...d };
      if (value.trim()) next[code] = value;
      else delete next[code];
      return next;
    });
  };

  const fillSuggested = () =>
    setDraft((d) => {
      const next = { ...d };
      for (const r of visible) if (!(next[r.code] ?? "").trim() && r.suggested > 0) next[r.code] = String(r.suggested).replace(".", ",");
      return next;
    });

  const clearBrand = () => {
    if (!window.confirm(`Obrisati sve upisane količine za „${label}“?`)) return;
    setDraft((d) => {
      const next = { ...d };
      for (const r of inBrand) delete next[r.code];
      return next;
    });
    setMsg(null);
  };

  const download = () =>
    start(async () => {
      setMsg(null);
      const r = await orderFileAction({ label, lines: entered.map((x) => ({ code: x.r.code, quantity: x.v })) });
      if (!r.ok) return setMsg({ ok: false, text: r.text });
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg({ ok: true, text: `Preuzet fajl ${r.fileName} (${r.count} ${plural(r.count, "stavka", "stavke", "stavki")})${r.skipped ? `; ${r.skipped} šifara nije pronađeno i nisu u fajlu` : ""}.` });
    });

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          <span>Brend</span>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {data.brands.map((b) => (
              <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
            ))}
            <option value={ALL}>Svi brendovi ({data.rows.length})</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Poručujem za</span>
          <select
            value={data.coverDays}
            disabled={navigating}
            onChange={(e) => startNav(() => router.push(`/portal/nabavka?dana=${e.target.value}`, { scroll: false }))}
          >
            {coverChoices.map((d) => (
              <option key={d} value={d}>{d} dana</option>
            ))}
          </select>
        </label>
        <label className={`${styles.field} ${styles.grow}`}>
          <span>Pretraga</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naziv ili šifra" autoComplete="off" />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Samo artikli koji se prodaju
        </label>
      </div>

      <p className={styles.info}>
        <b>Predlog</b> = prosečna prodaja u poslednjih {historyDays} dana × {data.coverDays} dana − lager, zaokruženo naviše na celo pakovanje. To je samo pomoć —
        u fajl ide samo ono što upišete u „Poručujem“.{" "}
        {data.stockDate ? (
          <>
            Lager: stanje od <b>{dmy(data.stockDate)}</b>
            {stale ? <span className={styles.stale}> ({stale})</span> : null}.
          </>
        ) : (
          <span className={styles.stale}>Lager još nije uvezen — predlog ne oduzima stanje magacina.</span>
        )}{" "}
        Dani kada artikla nije bilo na stanju još se ne izuzimaju iz proseka.
      </p>

      <div className={styles.tablewrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {head("artikal", "Artikal")}
              {head("prodato30", "Prodato 30 d", "right")}
              {head("prodato", `Prodato ${historyDays} d`, "right")}
              {head("lager", "Lager", "right")}
              {head("predlog", "Predlog", "right")}
              {head("porucujem", "Poručujem", "right")}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const v = draft[r.code] ?? "";
              const bad = Number.isNaN(parseOrderQuantity(v));
              const unit = r.unit ?? "";
              return (
                <tr key={r.key} className={v.trim() && !bad ? styles.filled : undefined}>
                  <td className={styles.article}>
                    <span className={styles.name}>{r.name}</span>
                    {r.isNew ? <span className={styles.tag} data-t="novo">nova šifra</span> : r.trend ? <span className={styles.tag} data-t={r.trend}>{TREND[r.trend]}</span> : null}
                    <span className={styles.sub}>
                      <span className={styles.code}>{r.code}</span>
                      {brand === ALL ? ` · ${r.brand}` : ""}
                      {r.isNew ? " · nema je u šifarniku portala" : r.lastSaleOn ? ` · poslednja prodaja ${dmy(r.lastSaleOn)}` : " · bez prodaje 12 meseci"}
                    </span>
                  </td>
                  <td className={styles.num} data-label="Prodato 30 d">{r.sold30 ? `${fmt(r.sold30)} ${unit}` : <span className={styles.zero}>0</span>}</td>
                  <td className={styles.num} data-label={`Prodato ${historyDays} d`}>
                    {r.sold180 ? `${fmt(r.sold180)} ${unit}` : <span className={styles.zero}>0</span>}
                    {r.customers180 ? <span className={styles.sub}>{r.customers180} {r.customers180 === 1 ? "kupac" : "kupaca"}</span> : null}
                  </td>
                  <td className={styles.num} data-label="Lager">{r.stock === null ? <span className={styles.zero} title="Šifra nije u izvozu lagera ili je količina nejasna">—</span> : `${fmt(r.stock)} ${unit}`}</td>
                  <td className={styles.num} data-label="Predlog">
                    {r.suggested > 0 ? <span className={styles.suggest}>{fmt(r.suggested)} {unit}</span> : <span className={styles.zero}>—</span>}
                    {r.suggested > 0 && r.packs !== null && r.pack ? <span className={styles.sub}>{r.packs} × {r.pack.label}</span> : null}
                  </td>
                  <td className={`${styles.num} ${styles.order}`} data-label="Poručujem">
                    <input
                      className={`${styles.qty} ${bad ? styles.bad : ""}`}
                      inputMode="decimal"
                      value={v}
                      onChange={(e) => setQty(r.code, e.target.value)}
                      placeholder={r.suggested > 0 ? fmt(r.suggested) : ""}
                      aria-label={`Poručujem: ${r.name}`}
                      aria-invalid={bad || undefined}
                    />
                    {unit ? <span className={styles.unit}>{unit}</span> : null}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>{q ? "Nema artikla sa tim nazivom ili šifrom." : "Nema artikala koji se prodaju za ovaj izbor."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={styles.foot}>
        <span>
          {label}: upisano <b>{entered.length}</b> {plural(entered.length, "stavka", "stavke", "stavki")}
          {invalid ? <span className={styles.stale}> · {invalid} {plural(invalid, "neispravna količina", "neispravne količine", "neispravnih količina")}</span> : null}
          {msg ? <span className={styles.msg} data-ok={String(msg.ok)}> · {msg.text}</span> : null}
        </span>
        <span className={styles.actions}>
          <button type="button" className={styles.button} onClick={fillSuggested} disabled={!visible.some((r) => r.suggested > 0)}>Popuni prazna predlogom</button>
          <button type="button" className={styles.button} onClick={clearBrand} disabled={!entered.length && !invalid}>Obriši upisano</button>
          {canExport ? (
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={download} disabled={pending || !entered.length || invalid > 0}>
              {pending ? "Pravim fajl…" : "Preuzmi porudžbinu (Excel)"}
            </button>
          ) : null}
        </span>
      </div>
    </section>
  );
}
