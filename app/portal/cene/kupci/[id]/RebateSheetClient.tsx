"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { DateField } from "@/components/portal/DateField";
import type { SheetCell, SheetRow } from "@/lib/pricing/customer-rebate-service";
import { evaluateEdit } from "@/lib/pricing/rebateSheet.mjs";
import { saveRebatesAction, type SaveRebatesState } from "../actions";
import { rememberCustomer } from "../RecentCustomers";
import { dmy, money, pct, pctNum } from "../format";

type Option = { code: string | null; label: string; short: string; key: string; base: number | null };
type Edit = { field: "r" | "c"; value: string };
type Period = "sada" | "datum" | "akcija";

const keyOf = (articleId: string, code: string | null) => `${articleId}|${code ?? ""}`;

/** VP cena na dan (danas ili posle zakazane promene iz cenovnika). */
function vpOn(row: SheetRow, day: string) {
  return row.vpNext && day >= row.vpNext.from ? row.vpNext.cents : row.vpCents;
}

export function RebateSheetClient(props: {
  customerId: string;
  customerName: string;
  today: string;
  options: Option[];
  rows: SheetRow[];
  canEdit: boolean;
  isOffice: boolean;
  role: string;
  reps: string[];
  footer: { shown: number; total: number; page: number; pages: number; prev: string | null; next: string | null };
}) {
  const { customerId, today, options, rows, canEdit, isOffice } = props;
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [review, setReview] = useState(false);
  const [period, setPeriod] = useState<Period>("sada");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState<SaveRebatesState | null>(null);
  const [pending, start] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => rememberCustomer({ id: customerId, name: props.customerName }), [customerId, props.customerName]);

  const count = Object.keys(edits).length;
  // Nesačuvane izmene: upozorenje pre napuštanja strane ili promene prikaza.
  useEffect(() => {
    if (!count) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank") return;
      if (!window.confirm(`Imate ${count} nesačuvanih izmena. Ako napustite prikaz, izmene se gube. Nastavite?`)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [count]);

  const effFrom = period === "sada" ? today : from;
  const rowById = useMemo(() => new Map(rows.map((r) => [r.articleId, r])), [rows]);

  const evaluated = useMemo(() => {
    const out: Record<string, ReturnType<typeof evaluateEdit>> = {};
    for (const [k, e] of Object.entries(edits)) {
      const [articleId, code] = k.split("|");
      const row = rowById.get(articleId);
      if (!row) continue;
      const i = options.findIndex((o) => (o.code ?? "") === code);
      const cell = row.cells[i];
      out[k] = evaluateEdit(e, vpOn(row, effFrom || today), { replacesArticleAgreement: cell?.articleAgreement });
    }
    return out;
  }, [edits, rowById, options, effFrom, today]);
  const errorCount = Object.values(evaluated).filter((v) => !v.ok).length;

  const setEdit = useCallback((k: string, e: Edit | null) => {
    setResult(null);
    setEdits((prev) => {
      const next = { ...prev };
      if (e === null) delete next[k];
      else next[k] = e;
      return next;
    });
  }, []);

  const focusCell = (rowIndex: number, col: string) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`input[data-row="${rowIndex}"][data-col="${col}"]`);
    if (el) {
      el.focus();
      el.select();
    }
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, col: string, k: string) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(rowIndex + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(rowIndex - 1, col);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEdit(k, null);
    }
  };

  /* --- Pregled pre čuvanja --- */
  const reviewRows = Object.entries(edits).map(([k, e]) => {
    const [articleId, code] = k.split("|");
    const row = rowById.get(articleId)!;
    const i = options.findIndex((o) => (o.code ?? "") === code);
    const cell = row?.cells[i];
    const ev = evaluated[k];
    return { k, row, option: options[i], cell, ev, e };
  });
  const promoConflicts =
    period === "akcija" && from && to
      ? reviewRows.filter(({ cell }) => {
          if (!cell) return false;
          const ranges = [...(cell.isPromo ? [{ from: cell.validFrom ?? "0000-00-00", to: cell.promoTo ?? "9999-12-31" }] : []), ...cell.upcoming.filter((u) => u.kind === "akcija").map((u) => ({ from: u.from, to: u.to ?? "9999-12-31" }))];
          return ranges.some((r) => r.from <= to && from <= r.to);
        })
      : [];
  const periodError =
    period === "sada"
      ? null
      : !from
        ? "Upišite datum početka (dd/mm/gggg)."
        : from < today
          ? "Početak ne može biti pre današnjeg dana."
          : period === "akcija" && !to
            ? "Akcija mora imati kraj."
            : period === "akcija" && to < from
              ? "Kraj akcije je pre početka."
              : null;
  const serverConflict = result && !result.ok && result.code === "preklapanje";
  const needsReplace = promoConflicts.length > 0 || Boolean(serverConflict);
  const cantSave = !count || errorCount > 0 || Boolean(periodError) || (needsReplace && !replace) || pending;

  const save = () =>
    start(async () => {
      const r = await saveRebatesAction({
        customerId,
        items: Object.entries(edits).map(([k, e]) => {
          const [articleId, code] = k.split("|");
          return { articleId, option: code === "" ? null : code, field: e.field, value: e.value };
        }),
        period: { kind: period, from: period === "sada" ? null : from, to: period === "akcija" ? to : null },
        replaceConfirmed: replace,
        note,
      });
      setResult(r);
      if (r.ok) {
        setEdits({});
        setReview(false);
        setPeriod("sada");
        setFrom("");
        setTo("");
        setNote("");
        setReplace(false);
        router.refresh();
      } else if (r.code !== "preklapanje") {
        setReview(r.code === "period");
      }
    });

  const serverErr = new Map<string, string>();
  if (result && !result.ok) for (const d of result.details) serverErr.set(keyOf(d.articleId, d.option), d.message);

  const colCount = 4 + options.length * 2 + (isOffice ? 1 : 0) + 1;
  const promoLine = (c: SheetCell, o: Option) =>
    c.isPromo
      ? `${o.short}: akcija ${pct(c.rabat)} do ${dmy(c.promoTo)} — redovni ${pct(c.regularRabat)}; od ${dmy(c.afterPromo?.day)} se vraća ${pct(c.afterPromo?.rabat)} (${money(c.afterPromo?.priceCents)})`
      : null;

  return (
    <>
      {result?.ok ? (
        <div className="pn-note" data-tone="success" role="status">
          <span>
            <strong>Sačuvano · {result.result.saved === 1 ? "1 izmena" : `${result.result.saved} izmena`}.</strong> Rabati važe {result.result.period}. {result.result.recipientsNote} Rabat na
            fakturi u BizniSoftu se i dalje kuca ručno.
          </span>
          <ul>
            {result.result.items.map((it, i) => (
              <li key={i} className="pn-num">
                {it.code} {it.name} · {it.option}: {it.before} → {it.after}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result && !result.ok && result.code !== "preklapanje" ? (
        <div className="pn-note" data-tone="danger" role="alert">
          <span><strong>Nije sačuvano.</strong> {result.message}</span>
        </div>
      ) : null}

      <section className="ck-wrap">
        <div className="ck-scroll">
          <table className="ck-table" ref={tableRef}>
            <colgroup>
              <col />
              <col style={{ width: isOffice ? 112 : 124 }} />
              <col style={{ width: 50 }} />
              <col style={{ width: 96 }} />
              {options.map((o) => (
                <Fragment key={o.code ?? "osn"}>
                  <col style={{ width: isOffice ? 80 : 92 }} />
                  <col style={{ width: isOffice ? 104 : 116 }} />
                </Fragment>
              ))}
              {isOffice ? <col style={{ width: 120 }} /> : null}
              <col style={{ width: 118 }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>Artikal</th>
                <th rowSpan={2}>Pakovanje</th>
                <th rowSpan={2}>JM</th>
                <th rowSpan={2} className="ck-r">VP cena</th>
                {options.map((o) => (
                  <th key={o.code ?? "osn"} colSpan={2} className="ck-opt-h" data-opt={o.key}>{o.short}</th>
                ))}
                {isOffice ? <th rowSpan={2} className="ck-r ck-sep">Poslednja faktura<br /><span style={{ fontWeight: 400 }}>{options.length > 1 ? "rabat" : ""}</span></th> : null}
                <th rowSpan={2} className="ck-sep">Status</th>
              </tr>
              <tr>
                {options.map((o) => (
                  <Fragment key={o.code ?? "osn"}>
                    <th className="ck-opt-sub ck-first" data-opt={o.key}>Rabat</th>
                    <th className="ck-opt-sub" data-opt={o.key}>Cena</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const changed = options.some((o) => edits[keyOf(row.articleId, o.code)]);
                const rowErr = options.map((o) => keyOf(row.articleId, o.code)).find((k) => (evaluated[k] && !evaluated[k].ok) || serverErr.has(k));
                const promo = row.cells.find((c) => c.isPromo);
                const status = rowErr
                  ? { t: "Greška", tone: "danger" }
                  : changed
                    ? { t: "Izmenjeno", tone: "changed" }
                    : row.cells.some((c) => c.status === "na_upit")
                      ? { t: "Nije potvrđeno", tone: "danger" }
                      : promo
                        ? { t: `Akcija do ${dmy(promo.promoTo).slice(0, 5)}`, tone: "warning" }
                        : row.cells.some((c) => c.newArticleDefault)
                          ? { t: "Nov artikal", tone: "info" }
                          : null;
                const isOpen = Boolean(open[row.articleId] || rowErr);
                const errText = rowErr ? (evaluated[rowErr] && !evaluated[rowErr].ok ? (evaluated[rowErr] as { error: string }).error : serverErr.get(rowErr)) : null;
                const unit = row.unit ?? "—";
                return (
                  <Fragment key={row.articleId}>
                    <tr data-changed={changed ? "true" : undefined} data-error={rowErr ? "true" : undefined}>
                      <td className="ck-art">
                        <div className="ck-art-name">{row.name}</div>
                        <div className="ck-code">{row.code}</div>
                      </td>
                      <td className="ck-desk">{row.pack ? row.pack.label : "—"}</td>
                      <td className="ck-desk">{unit}</td>
                      <td className="ck-desk ck-r ck-num">{money(row.vpCents)}</td>
                      <td className="ck-mini">
                        {row.pack ? `${row.pack.label} · ` : ""}cena po {unit} · VP <span className="ck-num">{money(row.vpCents)}</span>
                      </td>
                      {options.map((o, oi) => {
                        const k = keyOf(row.articleId, o.code);
                        const cell = row.cells[oi];
                        const e = edits[k];
                        const ev = evaluated[k];
                        const bad = (ev && !ev.ok) || serverErr.has(k);
                        const vp = vpOn(row, effFrom || today);
                        const noVp = !(vp && vp > 0);
                        const rVal = e ? (e.field === "r" ? e.value : ev?.ok ? pctNum(ev.percent) : "") : cell.rabat === null ? "" : pctNum(cell.rabat);
                        const cVal = e ? (e.field === "c" ? e.value : ev?.ok ? money(ev.priceCents ?? null) : "") : cell.priceCents === null ? "" : money(cell.priceCents);
                        const st = (typed: boolean) => (e ? (typed ? (bad ? "error" : "typed") : "derived") : undefined);
                        const rHint = e ? (e.field === "c" && ev?.ok ? (ev.exact ? "iz cene" : "najbliže iz cene") : `bilo ${pct(cell.rabat)}`) : cell.isPromo ? "akcija" : "";
                        const cHint = noVp ? "nema VP" : e ? (ev?.ok && e.field === "c" && !ev.exact ? `→ ${money(ev.priceCents ?? null)}` : `bilo ${money(cell.priceCents)}`) : "";
                        return (
                          <Fragment key={k}>
                            <td className="ck-opt ck-first" data-opt={o.key} data-label={`${o.short} · rabat`}>
                              {canEdit ? (
                                <>
                                  <input
                                    className="ck-inp"
                                    inputMode="decimal"
                                    aria-label={`${o.label}: rabat u procentima — ${row.name}`}
                                    value={rVal}
                                    placeholder="—"
                                    data-row={ri}
                                    data-col={`r${oi}`}
                                    data-state={st(!e || e.field === "r")}
                                    aria-invalid={bad && e?.field === "r" ? true : undefined}
                                    onChange={(ev2) => setEdit(k, { field: "r", value: ev2.target.value })}
                                    onKeyDown={(ev2) => onKey(ev2, ri, `r${oi}`, k)}
                                  />
                                  <span className="ck-hint">{rHint}</span>
                                </>
                              ) : (
                                <span className="ck-val ck-val-r">{cell.status === "cena" || cell.rabat !== null ? pct(cell.rabat) : "—"}</span>
                              )}
                            </td>
                            <td className="ck-opt" data-opt={o.key} data-label={`${o.short} · cena / ${unit}`}>
                              {canEdit ? (
                                <>
                                  <input
                                    className="ck-inp"
                                    inputMode="decimal"
                                    aria-label={`${o.label}: cena bez PDV-a po ${unit} — iz nje se računa rabat — ${row.name}`}
                                    value={cVal}
                                    placeholder="—"
                                    disabled={noVp}
                                    title={noVp ? "Artikal nema VP cenu, pa se iz cene ne može izračunati rabat. Upišite rabat ili uvezite VP cenovnik." : undefined}
                                    data-row={ri}
                                    data-col={`c${oi}`}
                                    data-state={st(Boolean(e && e.field === "c"))}
                                    aria-invalid={bad && e?.field === "c" ? true : undefined}
                                    onChange={(ev2) => setEdit(k, { field: "c", value: ev2.target.value })}
                                    onKeyDown={(ev2) => onKey(ev2, ri, `c${oi}`, k)}
                                  />
                                  <span className="ck-hint" data-tone={noVp ? "danger" : undefined}>{cHint}</span>
                                </>
                              ) : (
                                <span className="ck-val ck-val-c">{cell.priceCents === null ? (cell.status === "na_upit" ? "na upit" : "—") : money(cell.priceCents)}</span>
                              )}
                            </td>
                          </Fragment>
                        );
                      })}
                      {isOffice ? (
                        <td className="ck-r ck-sep ck-desk">
                          <div className="ck-num">{row.last ? pct(row.last.rabat) : "—"}</div>
                          {row.last ? <div className="pn-small" style={{ color: row.last.differs ? "var(--pn-warn-ink)" : "var(--p-muted)", fontWeight: row.last.differs ? 600 : 400 }}>{dmy(row.last.issuedOn)}{row.last.differs ? " · drugačije" : ""}</div> : null}
                        </td>
                      ) : null}
                      <td className="ck-sep ck-st-cell">
                        <div className="ck-st">
                          {status ? <span className="ck-tag" data-tone={status.tone}>{status.t}</span> : null}
                          <button type="button" className="ck-link" aria-expanded={isOpen} onClick={() => setOpen((p) => ({ ...p, [row.articleId]: !p[row.articleId] }))}>
                            {isOpen ? "Sakrijte detalje" : "Detalji"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="ck-detail">
                        <td colSpan={colCount}>
                          {errText ? <div role="alert" className="pn-error" style={{ fontSize: 15, padding: "6px 0 2px" }}>{errText}</div> : null}
                          <ul className="ck-details">
                            {options.map((o, oi) => {
                              const c = row.cells[oi];
                              return (
                                <Fragment key={o.code ?? "osn"}>
                                  <li>
                                    {o.short}: {c.status === "na_upit" ? (c.message ?? "nema dogovora") : `${c.sourceLabel} ${pct(c.rabat)}`}
                                    {c.validFrom ? ` · važi od ${dmy(c.validFrom)}` : ""}
                                    {c.savedBy ? ` · sačuvao ${c.savedBy}${c.savedAt ? ` ${c.savedAt}` : ""}` : ""}
                                    {c.fixedPriceRule ? " · staro pravilo sa fiksnom cenom — izmena ga zamenjuje rabatom" : ""}
                                  </li>
                                  {c.isPromo ? <li data-tone="promo">{promoLine(c, o)}</li> : null}
                                  {c.upcoming.map((u, ui) => (
                                    <li key={ui} data-tone="next">
                                      {o.short}: {u.kind === "akcija" ? `zakazana akcija ${pct(u.rabat)} · ${dmy(u.from)}–${dmy(u.to)}` : `od ${dmy(u.from)} rabat ${pct(u.rabat)}`}
                                    </li>
                                  ))}
                                </Fragment>
                              );
                            })}
                            {row.vpNext ? <li data-tone="next">Nova VP cena od {dmy(row.vpNext.from)}: {money(row.vpNext.cents)} po {unit} — rabati ostaju isti, cene se preračunavaju.</li> : null}
                            {row.pack && row.pack.quantity !== 1 ? (
                              <li>
                                Cena pakovanja ({row.pack.label}):{" "}
                                {options.map((o, oi) => (row.cells[oi].priceCents === null ? null : `${o.short.toLowerCase()} ${money(Math.round(row.cells[oi].priceCents! * row.pack!.quantity))}`)).filter(Boolean).join(" · ") || "—"}
                              </li>
                            ) : null}
                            {!isOffice ? <li data-tone="muted">Poslednja faktura (BizniSoft): {row.last ? `rabat ${pct(row.last.rabat)} · ${dmy(row.last.issuedOn)}` : "nije kupovano"}</li> : null}
                          </ul>
                          {canEdit ? (
                            <div className="ck-detail-actions">
                              {options.map((o, oi) =>
                                row.cells[oi].articleAgreement && o.base !== null ? (
                                  <button key={o.code ?? "osn"} type="button" className="pn-btn" data-size="sm" onClick={() => setEdit(keyOf(row.articleId, o.code), { field: "r", value: pctNum(o.base) })}>
                                    Upišite osnovni rabat {pct(o.base)} — {o.short}
                                  </button>
                                ) : null,
                              )}
                              {changed ? (
                                <button type="button" className="pn-btn" data-size="sm" onClick={() => options.forEach((o) => setEdit(keyOf(row.articleId, o.code), null))}>
                                  Vratite na sačuvano
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="pn-empty" style={{ padding: 20 }}>Nijedan artikal ne odgovara pretrazi i izabranom prikazu.</p> : null}
        </div>
        <div className="ck-foot">
          <span>
            {props.footer.total} artikala{props.footer.pages > 1 ? ` · strana ${props.footer.page} od ${props.footer.pages}` : ""}
            {canEdit ? " · upisano polje je žuto, izračunato u sivom kurzivu" : ""}
          </span>
          <span className="ck-pages">
            {props.footer.prev ? <Link href={props.footer.prev} className="ck-chip">← Prethodna</Link> : null}
            {props.footer.next ? <Link href={props.footer.next} className="ck-chip">Sledeća →</Link> : null}
            {canEdit ? <span className="pn-small">Tab između polja · Enter i ↑↓ menjaju red · Esc vraća polje</span> : null}
          </span>
        </div>
      </section>

      {canEdit ? (
        <div className="ck-bar" data-review={review ? "true" : undefined}>
          {review ? (
            <>
              <h2 className="pn-h2">Pregled pre čuvanja</h2>
              <div className="ck-wrap">
                <table className="pn-table pn-table-cards">
                  <thead>
                    <tr>
                      <th>Artikal</th>
                      <th>Plaćanje</th>
                      <th className="pn-r">Sada</th>
                      <th className="pn-r">Čuva se rabat</th>
                      <th className="pn-r">Cena iz rabata</th>
                      <th>Napomena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map(({ k, row, option, cell, ev }) => (
                      <tr key={k}>
                        <td data-label="Artikal"><strong>{row?.name}</strong> <span className="pn-sub pn-num">{row?.code}</span></td>
                        <td data-label="Plaćanje">{option?.short}</td>
                        <td data-label="Sada" className="pn-r pn-muted">{cell?.status === "cena" ? `${pct(cell.rabat)} · ${money(cell.priceCents)}` : "nije potvrđena"}</td>
                        <td data-label="Čuva se rabat" className="pn-r pn-strong">{ev?.ok ? pct(ev.percent) : "—"}</td>
                        <td data-label="Cena iz rabata" className="pn-r pn-strong">{ev?.ok ? money(ev.priceCents ?? null) : "—"}</td>
                        <td data-label="Napomena" style={{ color: ev && !ev.ok ? "var(--pn-danger)" : ev && ev.ok && !ev.exact ? "var(--pn-warn-ink)" : "var(--pn-ok-ink)" }}>
                          {!ev ? "" : !ev.ok ? ev.error : !ev.exact ? `Uneta cena se ne može tačno dobiti; najbliža iz rabata ${money(ev.priceCents ?? null)}` : "U redu"}
                          {ev?.ok && period === "akcija" && cell ? ` · posle akcije važi redovni ${pct(cell.isPromo ? cell.regularRabat : cell.rabat)}` : ""}
                          {ev?.ok && period !== "akcija" && cell?.isPromo ? ` · akcija traje do ${dmy(cell.promoTo)}, novi redovni rabat važi posle nje` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ck-review-grid">
                <div className="pn-field">
                  <span className="pn-label" style={{ fontWeight: 600 }}>Važenje</span>
                  <div className="ck-periods" role="group" aria-label="Važenje">
                    {(
                      [
                        ["sada", "Od danas, bez isteka"],
                        ["datum", "Od datuma, bez isteka"],
                        ["akcija", "Akcija od–do"],
                      ] as const
                    ).map(([p, l]) => (
                      <button key={p} type="button" className="ck-chip" aria-pressed={period === p} onClick={() => { setPeriod(p); setReplace(false); setResult(null); }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {period !== "sada" ? <DateField name="od" label={period === "akcija" ? "Akcija od" : "Važi od"} value={from} onChange={(iso) => setFrom(iso)} required /> : null}
                {period === "akcija" ? <DateField name="do" label="Akcija do" value={to} onChange={(iso) => setTo(iso)} required /> : null}
                <div className="pn-field ck-note">
                  <label htmlFor="ck-napomena">Napomena <span className="pn-muted" style={{ fontWeight: 400 }}>(nije obavezna)</span></label>
                  <input id="ck-napomena" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="npr. dogovor sa kupcem" />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 15 }}>
                {period === "sada"
                  ? "Novi rabati važe od danas, bez isteka; cena se uvek računa iz važeće VP cene."
                  : period === "datum"
                    ? from
                      ? `Do ${dmy(from)} važe sadašnji rabati, od tada novi, bez isteka.`
                      : "Upišite datum."
                    : from && to
                      ? `Akcijski rabat važi ${dmy(from)}–${dmy(to)}. Redovni rabat se pamti i posle akcije se sam vraća, na tada važeću VP cenu.`
                      : "Upišite period akcije."}{" "}
                <span className="pn-muted">
                  {props.role === "komercijalista" ? "Obaveštenje dobija vlasnik." : props.reps.length ? `Obaveštenje dobija ${props.reps.join(", ")}.` : "Kupac nema dodeljenog komercijalistu — obaveštenje ne ide nikome."} Kupac ne dobija obaveštenje.
                </span>
              </p>
              {needsReplace ? (
                <div className="pn-note" data-tone="danger" role="alert">
                  <span>
                    <strong>Preklapanje sa postojećom akcijom.</strong>{" "}
                    {serverConflict
                      ? result.details.map((d) => d.message).join(" · ")
                      : promoConflicts.map(({ row, option }) => `${row.name} · ${option.short}`).join(" · ")}
                  </span>
                  <label className="pn-check" style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                    <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} style={{ width: 20, height: 20 }} />
                    Zamenite: postojeća akcija traje do dana pre nove; posle nove vraća se redovni rabat
                  </label>
                </div>
              ) : null}
              {periodError ? <p className="pn-error" role="alert">{periodError}</p> : null}
            </>
          ) : null}
          <div className="ck-bar-row">
            <span className="ck-bar-title">{count === 0 ? "Nema nesačuvanih izmena" : count === 1 ? "1 izmena nije sačuvana" : `${count} izmene nisu sačuvane`}</span>
            <span className="pn-small" style={{ color: errorCount ? "var(--pn-danger)" : "var(--p-muted)", fontWeight: errorCount ? 600 : 400 }}>
              {count === 0 ? "Upišite rabat ili cenu u tabeli." : errorCount ? `${errorCount} sa greškom — ispravite pre čuvanja` : ""}
            </span>
            <div className="pn-actions">
              {review ? <button type="button" className="pn-btn" onClick={() => setReview(false)}>Nazad na tabelu</button> : null}
              <button type="button" className="pn-btn" disabled={!count || pending} onClick={() => { setEdits({}); setReview(false); setResult(null); }}>Poništite izmene</button>
              {review ? (
                <button type="button" className="pn-btn" data-variant="primary" disabled={cantSave} aria-busy={pending || undefined} onClick={save}>
                  {pending ? "Čuva se…" : `Potvrdite i sačuvajte (${count})`}
                </button>
              ) : (
                <button type="button" className="pn-btn" data-variant="primary" disabled={!count} onClick={() => setReview(true)}>
                  Sačuvajte izmene ({count})
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="ck-readonly"><strong>Samo pregled.</strong> {isOffice ? "Rabate menja komercijalista kupca ili vlasnik." : "Vaša uloga vidi dogovorene rabate i cene, ali ih ne menja."}</div>
      )}
    </>
  );
}

