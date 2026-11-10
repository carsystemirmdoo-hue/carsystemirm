"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import type { OfferRow } from "@/lib/recommendations/customer-offer-service";
import { DISMISS_REASONS } from "@/lib/recommendations/customerOffer.mjs";
import { STATUS_LABELS } from "@/lib/recommendations/policy.mjs";
import { nextSort, sortRows } from "@/lib/ui/sortRows.mjs";
import { SortHeader } from "@/components/portal/SortHeader";
import { staleNote, stockRank, stockShort, workdaysSince } from "@/lib/stock/stockAge.mjs";
import { dismissArticleAction, restoreArticleAction } from "./actions";
import { RepOrderDialog } from "./RepOrderDialog";
import styles from "./CustomerOffer.module.css";

/**
 * Preporuke kupca (2026-11-10) — po odobrenom nacrtu: artikli u ritmu, šta je bilo na poslednjoj
 * fakturi i šta bi kupac dobio danas, izbor za ponudu (Excel) i „Ne uzima više“ sa razlogom.
 */

const OFFER = new Set(["overdue", "due", "due_soon"]);
const TILES = [
  ["overdue", "Kasni", styles.tKasni],
  ["due", "Treba sada", styles.tSada],
  ["due_soon", "Uskoro", styles.tUskoro],
  ["not_yet", "Još nije vreme", ""],
  ["dormant", "Duže ne uzima", ""],
] as const;

const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = (c: number) => money(c / 100);
const pct = (p: number | null) => (p === null ? "—" : `${String(Math.round(p * 1000) / 1000).replace(".", ",")} %`);
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
const qty = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 3 });
/** Redosled statusa kada se ređa po koloni „Status“: najhitnije prvo. */
const STATUS_RANK: Record<string, number> = { overdue: 0, due: 1, due_soon: 2, not_yet: 3, provisional: 4, dormant: 5, insufficient_history: 6 };
type SortKey = "artikal" | "status" | "poslednja" | "ritam" | "trebalo" | "cenaRanije" | "cenaDanas" | "lager";
/** Vrednost za ređanje i prirodan prvi smer (npr. „Poslednja kupovina“ od najstarije = najduže nije uzimao). */
const SORT: Record<SortKey, { value: (r: OfferRow) => string | number | null; first: "asc" | "desc" }> = {
  artikal: { value: (r) => r.articleName, first: "asc" },
  status: { value: (r) => STATUS_RANK[r.rec.status] ?? 9, first: "asc" },
  poslednja: { value: (r) => r.rec.lastPurchaseOn, first: "asc" },
  ritam: { value: (r) => r.rec.medianIntervalDays, first: "asc" },
  trebalo: { value: (r) => r.rec.daysUntilExpected, first: "asc" },
  cenaRanije: { value: (r) => (r.last ? r.last.unitPrice * (1 - r.last.discountPercent / 100) : null), first: "desc" },
  cenaDanas: { value: (r) => r.today?.netCents ?? null, first: "desc" },
  lager: { value: (r) => stockRank(r.stock?.state), first: "asc" },
};
const label = (s: string) => (STATUS_LABELS as Record<string, string>)[s] ?? s;

export function CustomerOffer({
  customerId,
  rows,
  today,
  canEdit,
  canOrder = false,
  phone = null,
  stockDate = null,
}: {
  customerId: string;
  rows: OfferRow[];
  today: string;
  canEdit: boolean;
  canOrder?: boolean;
  phone?: string | null;
  stockDate?: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"ponuda" | "svi">("ponuda");
  const [tile, setTile] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<OfferRow | null>(null);
  const [reason, setReason] = useState("drugi_dobavljac");
  const [replacement, setReplacement] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // Podrazumevano: najveće kašnjenje prvo (kao i do sada).
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "trebalo", dir: "asc" });
  const dialog = useRef<HTMLDialogElement>(null);
  const [ordering, setOrdering] = useState(false);
  const showStock = rows.some((r) => r.stock);
  const stale = stockDate ? staleNote(workdaysSince(stockDate, today)) : null;

  const live = useMemo(() => rows.filter((r) => !r.dismissal), [rows]);
  const gone = useMemo(() => rows.filter((r) => r.dismissal), [rows]);
  const visible = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("sr-Latn");
    const filtered = live
      .filter((r) => (tile ? r.rec.status === tile : view === "svi" || OFFER.has(r.rec.status)))
      .filter((r) => !t || `${r.articleName} ${r.articleCode} ${r.brand ?? ""}`.toLocaleLowerCase("sr-Latn").includes(t));
    return sortRows(filtered, SORT[sort.key].value, sort.dir);
  }, [live, q, tile, view, sort]);
  const head = (key: SortKey, text: string, align: "left" | "right" = "left") => (
    <SortHeader
      label={text}
      active={sort.key === key}
      dir={sort.dir}
      align={align}
      onClick={() => setSort((cur) => nextSort(cur, key, SORT[key].first) as { key: SortKey; dir: "asc" | "desc" })}
    />
  );
  const chosen = live.filter((r) => sel.has(r.articleCode));
  const sum = chosen.reduce((s, r) => s + (r.today && r.last ? r.today.netCents * r.last.quantity : 0), 0);

  const toggle = (set: Set<string>, code: string) => {
    const n = new Set(set);
    if (n.has(code)) n.delete(code);
    else n.add(code);
    return n;
  };
  const exportHref = `/api/portal/kupci/${customerId}/ponuda?${chosen.map((r) => `a=${encodeURIComponent(r.articleCode)}`).join("&")}`;

  const askRemove = (r: OfferRow) => {
    setRemoving(r);
    setReason("drugi_dobavljac");
    setReplacement("");
    setNote("");
    setMsg(null);
    dialog.current?.showModal();
  };
  const confirmRemove = () => {
    if (!removing) return;
    const r = removing;
    start(async () => {
      const res = await dismissArticleAction({ customerId, articleCode: r.articleCode, reason, replacementCode: replacement, note });
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      dialog.current?.close();
      setSel((s) => { const n = new Set(s); n.delete(r.articleCode); return n; });
      setMsg({ ok: true, text: `${r.articleName} je skinut iz preporuka. Vidi se u delu „Ne kupuje više“.` });
      router.refresh();
    });
  };
  const restore = (r: OfferRow) => {
    if (!r.dismissal) return;
    const id = r.dismissal.id;
    start(async () => {
      const res = await restoreArticleAction({ customerId, dismissalId: id });
      setMsg(res.ok ? { ok: true, text: `${r.articleName} je vraćen u preporuke.` } : { ok: false, text: res.error });
      router.refresh();
    });
  };

  const timeline = (r: OfferRow) => {
    const pts = [...r.history.map((h) => h.issuedOn), r.rec.expectedNextOn, today].filter((x): x is string => Boolean(x));
    const t = pts.map((d) => Date.parse(d));
    const min = Math.min(...t) - 6 * 864e5;
    const max = Math.max(...t) + 6 * 864e5;
    const x = (d: string) => `${(((Date.parse(d) - min) / (max - min)) * 100).toFixed(2)}%`;
    return (
      <div className={styles.timeline} aria-hidden="true">
        {r.history.map((h, i) => <span key={i} className={styles.dot} style={{ left: x(h.issuedOn) }} title={`${dmy(h.issuedOn)} · ${qty(h.quantity)} ${r.unit ?? ""}`} />)}
        {r.rec.expectedNextOn ? <span className={`${styles.dot} ${styles.exp}`} style={{ left: x(r.rec.expectedNextOn) }} title={`očekivano ${dmy(r.rec.expectedNextOn)}`} /> : null}
        <span className={styles.today} style={{ left: x(today) }} title="danas" />
        {r.rec.expectedNextOn ? <span className={styles.tl} style={{ left: x(r.rec.expectedNextOn), color: "var(--p-red-dark)" }}>očekivano</span> : null}
        {r.history.length ? <span className={styles.tl} style={{ left: x(r.history[r.history.length - 1].issuedOn) }}>{dmy(r.history[r.history.length - 1].issuedOn)}</span> : null}
      </div>
    );
  };

  const deviation = (d: number | null) =>
    d === null ? "—" : d < 0 ? <span className={styles.late}>kasni {-d} d</span> : d === 0 ? "danas" : <span className={styles.soon}>za {d} d</span>;

  return (
    <>
      {msg ? <p className={`${styles.msg} ${msg.ok ? "" : styles.err}`} role="status">{msg.text}</p> : null}
      <section className={styles.metrics} aria-label="Sažetak po statusu">
        {TILES.map(([k, l, cls]) => (
          <button key={k} type="button" className={cls} aria-pressed={tile === k} onClick={() => setTile(tile === k ? null : k)}>
            <span>{l}</span>
            <strong>{live.filter((r) => r.rec.status === k).length}</strong>
          </button>
        ))}
      </section>

      <section className={styles.panel} aria-label="Preporuke po artiklu">
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pretraga: naziv, šifra, brend (npr. klar)" aria-label="Pretraga artikala" />
          </label>
          <div className={styles.seg} role="group" aria-label="Prikaz">
            <button type="button" className={view === "ponuda" && !tile ? styles.on : undefined} aria-pressed={view === "ponuda" && !tile} onClick={() => { setView("ponuda"); setTile(null); }}>Za ponudu</button>
            <button type="button" className={view === "svi" && !tile ? styles.on : undefined} aria-pressed={view === "svi" && !tile} onClick={() => { setView("svi"); setTile(null); }}>Svi artikli</button>
          </div>
          <button type="button" className={styles.button} onClick={() => setSel(new Set([...sel, ...visible.map((r) => r.articleCode)]))} disabled={!visible.length}>Označi sve prikazane</button>
        </div>

        <div className={styles.tablewrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.check} aria-label="Izbor" />
                {head("artikal", "Artikal")}
                {head("status", "Status")}
                {head("poslednja", "Poslednja kupovina")}
                {head("ritam", "Ritam")}
                {head("trebalo", "Trebalo je")}
                {head("cenaRanije", "Poslednji put", "right")}
                {head("cenaDanas", "Danas", "right")}
                {showStock ? head("lager", "Lager") : null}
                <th aria-label="Radnje" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const isOpen = open.has(r.articleCode);
                const changed = r.today && r.last && r.today.discountPercent !== null && Math.abs(r.today.discountPercent - r.last.discountPercent) >= 0.0005;
                return (
                  <Fragment key={r.articleCode}>
                    <tr
                      className={`${styles.row} ${sel.has(r.articleCode) ? styles.sel : ""}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("input, button, a")) return;
                        setOpen(toggle(open, r.articleCode));
                      }}
                      aria-expanded={isOpen}
                    >
                      <td className={styles.cCheck}>
                        <input type="checkbox" checked={sel.has(r.articleCode)} onChange={() => setSel(toggle(sel, r.articleCode))} aria-label={`Izaberite ${r.articleName}`} />
                      </td>
                      <td className={styles.cName}>
                        <span className={styles.name}>{r.articleName}</span>
                        <span className={styles.sub}>
                          <span className={styles.code}>{r.articleCode}</span>
                          {r.brand ? ` · ${r.brand}` : ""}
                          {r.lid ? " · uz poklopac" : ""}
                        </span>
                      </td>
                      <td data-label="Status"><span className={styles.pill} data-s={r.rec.status}>{label(r.rec.status)}</span></td>
                      <td className={styles.nowrap} data-label="Poslednja kupovina">
                        {dmy(r.rec.lastPurchaseOn)}
                        <span className={styles.sub}>{r.last ? `${qty(r.last.quantity)} ${r.unit ?? ""} · ` : ""}pre {r.rec.daysSinceLastPurchase} d</span>
                      </td>
                      <td className={styles.nowrap} data-label="Ritam">
                        {r.rec.medianIntervalDays ? `na ${r.rec.medianIntervalDays} d` : "—"}
                        <span className={styles.sub}>{r.rec.eventCount} kupovina</span>
                      </td>
                      <td className={styles.nowrap} data-label="Trebalo je">
                        {dmy(r.rec.expectedNextOn)}
                        <span className={styles.sub}>{deviation(r.rec.daysUntilExpected)}</span>
                      </td>
                      <td className={styles.num} data-label="Poslednji put">
                        {r.last ? money(r.last.unitPrice * (1 - r.last.discountPercent / 100)) : "—"}
                        <span className={styles.sub}>{r.last ? `VP ${money(r.last.unitPrice)} − ${pct(r.last.discountPercent)}` : ""}</span>
                      </td>
                      <td className={styles.num} data-label="Danas">
                        {r.today ? cents(r.today.netCents) : "na upit"}
                        <span className={`${styles.sub} ${changed ? styles.up : ""}`} style={r.today ? undefined : { whiteSpace: "normal", maxWidth: 180, marginLeft: "auto" }}>
                          {r.today ? (changed && r.last ? `rabat ${pct(r.last.discountPercent)} → ${pct(r.today.discountPercent)}` : `rabat ${pct(r.today.discountPercent)}`) : r.todayNote ?? ""}
                        </span>
                      </td>
                      {showStock ? (
                        <td className={styles.nowrap} data-label="Lager" title={r.stock ? `${r.stock.text}${stockDate ? ` (stanje ${dmy(stockDate)})` : ""}` : undefined}>
                          {r.stock ? <span className={styles.stock} data-s={r.stock.state}>{stockShort(r.stock.state)}</span> : "—"}
                          {r.stock && stale ? <span className={`${styles.sub} ${styles.stale}`}>{stale}</span> : null}
                        </td>
                      ) : null}
                      <td className={styles.cAct}>{canEdit ? <button type="button" className={styles.link} onClick={() => askRemove(r)}>Ne uzima više</button> : null}</td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detail}>
                        <td />
                        <td colSpan={showStock ? 9 : 8}>
                          <div className={styles.det}>
                            <div>
                              <h3>Kupovine</h3>
                              {timeline(r)}
                              <p className={styles.why}>{r.rec.explanation}</p>
                              {r.stock ? (
                                <p className={styles.why} style={{ marginTop: 8 }}>
                                  <b>Lager:</b> {r.stock.text}
                                  {stockDate ? ` — stanje od ${dmy(stockDate)}` : ""}
                                  {stale ? ` (${stale})` : ""}.
                                </p>
                              ) : null}
                              {r.lid ? <p className={styles.why} style={{ marginTop: 8 }}><b>Obavezan par:</b> u ponudu ide i {r.lid.code} {r.lid.name} u istoj količini.</p> : null}
                            </div>
                            <div>
                              <h3>Poslednje fakture</h3>
                              <table className={styles.hist}>
                                <thead><tr><th>Datum</th><th className={styles.num}>Količina</th><th className={styles.num}>Rabat</th><th className={styles.num}>Neto cena</th></tr></thead>
                                <tbody>
                                  {r.history.map((h, i) => (
                                    <tr key={i}>
                                      <td>{dmy(h.issuedOn)}</td>
                                      <td className={styles.num}>{qty(h.quantity)} {r.unit ?? ""}</td>
                                      <td className={styles.num}>{pct(h.discountPercent)}</td>
                                      <td className={styles.num}>{money(h.unitPrice * (1 - h.discountPercent / 100))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {visible.length === 0 ? <tr><td colSpan={showStock ? 10 : 9} className={styles.empty}>Nema artikala za ovaj izbor.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className={styles.legend}>
          „Poslednji put“ = VP cena, rabat i neto sa poslednje fakture. „Danas“ = neto i rabat koje bi kupac sada dobio po važećim uslovima.
          {showStock && stockDate ? ` „Lager“ = stanje magacina na dan ${dmy(stockDate)}${stale ? ` (${stale})` : ""}; broj komada je u detaljima reda.` : ""} Klik na red otvara detalje.
        </p>
        <div className={styles.foot}>
          <span>
            Označeno: <b>{chosen.length}</b> · vrednost po poslednjim količinama i današnjim cenama <b>{cents(sum)}</b> RSD bez PDV-a
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={`${styles.button} ${styles.clear}`} onClick={() => setSel(new Set())} disabled={!chosen.length}>Poništi izbor</button>
            {canOrder ? (
              <button type="button" className={`${styles.button} ${styles.dark}`} onClick={() => setOrdering(true)} disabled={!chosen.some((r) => r.articleId)}>
                Pošalji zahtev za kupca
              </button>
            ) : null}
            {chosen.length ? (
              <a className={`${styles.button} ${styles.primary}`} href={exportHref} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                Napravi ponudu (Excel)
              </a>
            ) : (
              <button type="button" className={`${styles.button} ${styles.primary}`} disabled>Napravi ponudu (Excel)</button>
            )}
          </span>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.section}`} aria-label="Ne kupuje više">
        <div className={styles.sectionHead}>
          <h2>Ne kupuje više ({gone.length})</h2>
          <p>Artikli skinuti iz preporuka, sa razlogom. Ne pojavljuju se u Preporukama, „Za razgovor“ ni na kartici kupca dok ih ne vratite.</p>
        </div>
        <div className={styles.tablewrap}>
          <table className={styles.table} style={{ minWidth: 820 }}>
            <thead><tr><th>Artikal</th><th>Razlog</th><th>Zabeležio</th><th>Poslednja kupovina</th><th aria-label="Radnje" /></tr></thead>
            <tbody>
              {gone.map((r) => (
                <tr key={r.articleCode}>
                  <td><span className={styles.name}>{r.articleName}</span><span className={`${styles.sub} ${styles.code}`}>{r.articleCode}</span></td>
                  <td>
                    <span className={styles.reason}>{r.dismissal!.reasonLabel}</span>
                    {r.dismissal!.replacement ? <span className={styles.sub}>zamenjen: {r.dismissal!.replacement}</span> : null}
                    {r.dismissal!.note ? <span className={styles.sub}>{r.dismissal!.note}</span> : null}
                  </td>
                  <td>{r.dismissal!.by}<span className={styles.sub}>{dmy(r.dismissal!.at)}</span></td>
                  <td>{dmy(r.rec.lastPurchaseOn)}</td>
                  <td>{canEdit ? <button type="button" className={styles.link} onClick={() => restore(r)} disabled={pending}>Vrati u preporuke</button> : null}</td>
                </tr>
              ))}
              {gone.length === 0 ? <tr><td colSpan={5} className={styles.empty}>Nema. „Ne uzima više“ je u poslednjoj koloni tabele iznad.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {ordering ? (
        <RepOrderDialog
          customerId={customerId}
          phone={phone}
          onClose={() => { setOrdering(false); router.refresh(); }}
          items={chosen
            .filter((r) => r.articleId)
            .map((r) => ({ articleId: r.articleId!, code: r.articleCode, name: r.articleName, unit: r.unit, quantity: r.last?.quantity ?? 1, lid: r.lid }))}
        />
      ) : null}

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="ne-uzima-naslov" onClose={() => setRemoving(null)}>
        <form className={styles.dlg} onSubmit={(e) => { e.preventDefault(); confirmRemove(); }}>
          <h2 id="ne-uzima-naslov">Kupac više ne uzima ovaj artikal</h2>
          <p>{removing ? `${removing.articleCode} · ${removing.articleName} — poslednji put ${dmy(removing.rec.lastPurchaseOn)}` : ""}</p>
          <fieldset className={styles.radios}>
            <legend className={styles.field}>Razlog</legend>
            {DISMISS_REASONS.map(([k, l]) => (
              <label key={k}><input type="radio" name="razlog" value={k} checked={reason === k} onChange={() => setReason(k)} /> {l}</label>
            ))}
          </fieldset>
          {reason === "zamenjen" ? (
            <label className={styles.field}>
              Kojim artiklom
              <select value={replacement} onChange={(e) => setReplacement(e.target.value)} required>
                <option value="">Izaberite artikal</option>
                {rows.filter((r) => r.articleCode !== removing?.articleCode && r.articleId).map((r) => (
                  <option key={r.articleCode} value={r.articleCode}>{r.articleCode} · {r.articleName}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.field}>
            Napomena {reason === "drugo" ? "" : "(neobavezno)"}
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="npr. uzima klar drugog brenda od drugog dobavljača" />
          </label>
          {msg && !msg.ok ? <p className={`${styles.msg} ${styles.err}`} role="alert">{msg.text}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => dialog.current?.close()}>Odustani</button>
            <button type="submit" className={`${styles.button} ${styles.dark}`} disabled={pending}>{pending ? "Čuvam…" : "Skini iz preporuka"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
