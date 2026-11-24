"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DateField } from "@/components/portal/DateField";
import { ARTIKAL, GRUPA, countOf } from "@/lib/ordering/plural.mjs";
import type { VpBaseRow } from "@/lib/pricing/vp-draft-service";
import { changePercent, LARGE_CHANGE_PERCENT, parseChangePercent, parsePriceCents, planDraft } from "@/lib/pricing/vpDraft.mjs";
import styles from "@/app/portal/cene/rabati-iz-faktura/kupci/[id]/tabela/RebateTable.module.css";
import { saveVpDraftAction } from "./actions";

/**
 * Priprema novog VP cenovnika na ekranu (2026-11-18). Raspored brend › grupa › artikal kao u
 * tabeli rabata. Upis: procenat za ceo brend, grupu ili artikal (+4, -2,5) ili tačna nova cena
 * artikla. Pregled novih cena se računa ovde istom funkcijom kao na serveru, ali server pri
 * čuvanju računa ponovo iz važećih cena — iznos iz pregledača se ne upisuje.
 */

type Edits = { brands: Record<string, number>; groups: Record<string, number>; articles: Record<string, number>; prices: Record<string, number> };
const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rsd = (c: number | null | undefined) => (c === null || c === undefined ? "—" : money.format(c / 100));
const pctText = (p: number | null) => (p === null ? "—" : `${p > 0 ? "+" : ""}${String(p).replace(".", ",")} %`);
const PAGE = 200;

function toInputs(e: Edits): Record<string, string> {
  const out: Record<string, string> = {};
  const t = (n: number) => String(n).replace(".", ",");
  for (const [k, v] of Object.entries(e.brands ?? {})) out[`b:${k}`] = t(v);
  for (const [k, v] of Object.entries(e.groups ?? {})) out[`g:${k}`] = t(v);
  for (const [k, v] of Object.entries(e.articles ?? {})) out[`a:${k}`] = t(v);
  for (const [k, v] of Object.entries(e.prices ?? {})) out[`c:${k}`] = money.format(v / 100);
  return out;
}

export function VpDraftEditor({
  rows,
  today,
  initial,
  autosave = false,
}: {
  rows: VpBaseRow[];
  today: string;
  initial: { id: string | null; title: string; proposedValidFrom: string | null; note: string; edits: Edits; rounding: string };
  /** Jedna strana VP cenovnika (2026-11-24): izmene se čuvaju same, Excel ih već sadrži. */
  autosave?: boolean;
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(initial.id);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>(() => toInputs(initial.edits));
  const [title, setTitle] = useState(initial.title);
  const [validFrom, setValidFrom] = useState(initial.proposedValidFrom ?? "");
  const [note, setNote] = useState(initial.note);
  const [rounding, setRounding] = useState<"para" | "dinar">(initial.rounding === "dinar" ? "dinar" : "para");
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("svi");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState(PAGE);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const { edits, bad } = useMemo(() => {
    const e: Edits = { brands: {}, groups: {}, articles: {}, prices: {} };
    const wrong = new Set<string>();
    for (const [k, v] of Object.entries(inputs)) {
      if (!v.trim()) continue;
      const kind = k.slice(0, 1);
      const id = k.slice(2);
      if (kind === "c") {
        const c = parsePriceCents(v);
        if (c === null) wrong.add(k);
        else e.prices[id] = c;
        continue;
      }
      const p = parseChangePercent(v);
      if (p === null) wrong.add(k);
      else if (kind === "b") e.brands[id] = p;
      else if (kind === "g") e.groups[id] = p;
      else e.articles[id] = p;
    }
    return { edits: e, bad: wrong };
  }, [inputs]);

  const plan = useMemo(() => planDraft(rows, edits, rounding), [rows, edits, rounding]);
  const itemBy = useMemo(() => new Map(plan.items.map((i) => [i.articleId, i])), [plan]);
  const ignoredBy = useMemo(() => new Map(plan.ignored.map((i) => [i.articleId, i.reason])), [plan]);
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))].sort((a, b) => Number(a === "Ostalo") - Number(b === "Ostalo") || a.localeCompare(b, "sr")), [rows]);

  const needle = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (brandFilter !== "svi" && r.brand !== brandFilter) return false;
        if (onlyChanged && !itemBy.has(r.articleId)) return false;
        if (needle && !`${r.name} ${r.code} ${r.group}`.toLowerCase().includes(needle)) return false;
        return true;
      }),
    [rows, brandFilter, onlyChanged, needle, itemBy],
  );
  const tree = useMemo(() => {
    const m = new Map<string, Map<string, VpBaseRow[]>>();
    for (const r of visible) {
      const g = m.get(r.brand) ?? new Map<string, VpBaseRow[]>();
      g.set(r.group, [...(g.get(r.group) ?? []), r]);
      m.set(r.brand, g);
    }
    return [...m].map(([brand, groups]) => ({ brand, groups: [...groups].map(([group, list]) => ({ group, list })) }));
  }, [visible]);
  const allIn = useMemo(() => {
    const brand = new Map<string, number>();
    const group = new Map<string, number>();
    for (const r of rows) {
      brand.set(r.brand, (brand.get(r.brand) ?? 0) + 1);
      group.set(r.group, (group.get(r.group) ?? 0) + 1);
    }
    return { brand, group };
  }, [rows]);
  const changedIn = useMemo(() => {
    const brand = new Map<string, number>();
    const group = new Map<string, number>();
    const byId = new Map(rows.map((r) => [r.articleId, r]));
    for (const it of plan.items) {
      const r = byId.get(it.articleId);
      if (!r) continue;
      brand.set(r.brand, (brand.get(r.brand) ?? 0) + 1);
      group.set(r.group, (group.get(r.group) ?? 0) + 1);
    }
    return { brand, group };
  }, [plan, rows]);

  const filtering = Boolean(needle) || brandFilter !== "svi" || onlyChanged;
  const isOpen = (key: string) => filtering || open.has(key);
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const setInput = (key: string, value: string) => {
    setResult(null);
    setInputs((s) => {
      const n = { ...s, [key]: value };
      // Procenat i tačna cena istog artikla isključuju jedno drugo.
      if (value.trim() && key.startsWith("a:")) delete n[`c:${key.slice(2)}`];
      if (value.trim() && key.startsWith("c:")) delete n[`a:${key.slice(2)}`];
      if (!value.trim()) delete n[key];
      return n;
    });
  };

  const pctInput = (key: string, label: string) => (
    <span className={styles.pct}>
      <input
        type="text"
        inputMode="decimal"
        className={bad.has(key) ? styles.bad : inputs[key] ? styles.dirty : undefined}
        value={inputs[key] ?? ""}
        placeholder="0"
        onChange={(e) => setInput(key, e.target.value)}
        aria-label={label}
      />
      %
    </span>
  );

  const artRow = (r: VpBaseRow, indent: boolean) => {
    const it = itemBy.get(r.articleId);
    const ch = it && r.oldCents ? changePercent(r.oldCents, it.newCents) : null;
    const big = ch !== null && Math.abs(ch) > LARGE_CHANGE_PERCENT;
    const cKey = `c:${r.articleId}`;
    return (
      <tr key={r.articleId} className={styles.art}>
        <td className={indent ? styles.nameArt : undefined}>
          {r.name}
          <span className={styles.sub}>
            <span className={styles.code}>{r.code}</span> · {r.group}
          </span>
        </td>
        <td className={styles.num}>{rsd(r.oldCents)}</td>
        <td>{pctInput(`a:${r.articleId}`, `Promena u procentima za ${r.name}`)}</td>
        <td className={styles.num}>
          <span className={styles.pct}>
            <input
              type="text"
              inputMode="decimal"
              className={`${styles.netInput} ${bad.has(cKey) ? styles.bad : inputs[cKey] ? styles.dirty : ""}`}
              value={inputs[cKey] ?? ""}
              placeholder={rsd(it?.newCents ?? r.oldCents)}
              onChange={(e) => setInput(cKey, e.target.value)}
              aria-label={`Tačna nova VP cena za ${r.name}`}
            />
          </span>
          {it ? <span className={big ? styles.noteWarn : styles.note}>{pctText(ch)}{it.origin !== "cena" && it.origin !== "artikal" ? ` · ${it.origin}` : ""}</span> : null}
          {ignoredBy.has(r.articleId) ? <span className={styles.noteWarn}>{ignoredBy.get(r.articleId)}</span> : null}
        </td>
      </tr>
    );
  };

  const save = (sendToOffice: boolean) => {
    start(async () => {
      const r = await saveVpDraftAction({ id: draftId, title: title.trim().length >= 3 || !autosave ? title : fallbackTitle, proposedValidFrom: validFrom || null, note, edits, rounding, sendToOffice });
      if (r.ok) {
        setResult({ ok: true, text: r.message });
        setDraftId(r.id);
        lastSaved.current = saveKey;
        if (sendToOffice || (!autosave && r.id !== initial.id)) router.push(`/portal/vp-cenovnik/${r.id}${sendToOffice ? "?korak=kancelarija" : ""}`);
        else router.refresh();
      } else setResult({ ok: false, text: r.error });
    });
  };

  // Automatsko čuvanje: 1,2 s posle poslednje izmene, samo ispravan unos; prvi upis pravi pripremu.
  const fallbackTitle = `Radna priprema ${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}.`;
  const saveKey = JSON.stringify([edits, rounding, title, validFrom, note]);
  const lastSaved = useRef(saveKey);
  useEffect(() => {
    if (!autosave || saveKey === lastSaved.current || bad.size > 0) return;
    if (!draftId && plan.items.length === 0) return;
    const t = setTimeout(async () => {
      const r = await saveVpDraftAction({ id: draftId, title: title.trim().length >= 3 ? title : fallbackTitle, proposedValidFrom: validFrom || null, note, edits, rounding });
      if (r.ok) {
        lastSaved.current = saveKey;
        setDraftId(r.id);
        setAutoError(null);
        setSavedAt(new Date().toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" }));
      } else setAutoError(r.error);
    }, 1200);
    return () => clearTimeout(t);
  }, [autosave, saveKey, bad.size, draftId, plan.items.length, title, fallbackTitle, validFrom, note, edits, rounding]);
  const excelHref = draftId ? `/api/portal/vp-cenovnik/izvoz?vrsta=priprema&id=${draftId}&sve=1` : "/api/portal/vp-cenovnik/izvoz?vrsta=vazeci";

  const brandEdits = Object.entries(edits.brands);
  const groupEdits = Object.entries(edits.groups);
  const titleOk = autosave || title.trim().length >= 3;
  const blocked = pending || bad.size > 0 || !titleOk || plan.items.length === 0;
  const flat = !filtering ? [] : visible.slice(0, shown);
  const useTree = !needle;

  return (
    <>
      {autosave ? (
        <div className="vp-topbar">
          <span className="vp-saved" role="status">
            {autoError ? <span className="portal-error">Nije sačuvano: {autoError}</span> : savedAt ? `Izmene su sačuvane u ${savedAt}.` : draftId ? "Izmene se čuvaju same." : "Upišite promenu — čuva se sama."}
          </span>
          <a className="portal-button" data-variant="primary" href={excelHref} download>
            Ceo cenovnik (Excel)
          </a>
        </div>
      ) : null}
      <section className={styles.metrics} aria-label="Sažetak">
        <div><span>Artikala sa VP cenom</span><strong>{rows.filter((r) => r.oldCents !== null).length}</strong></div>
        <div><span>Brendova</span><strong>{brands.length}</strong></div>
        <div className={styles.red}><span>Cena se menja</span><strong>{plan.items.length}</strong></div>
        <div><span>Bez promene</span><strong>{rows.length - plan.items.length}</strong></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input type="search" placeholder="Pretraga: naziv, šifra, grupa" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} aria-label="Pretraga artikala" />
          </label>
          <label className={styles.selectLabel}>
            Brend
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="svi">Svi brendovi</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <div className={styles.seg} role="group" aria-label="Prikaz">
            <button type="button" className={!onlyChanged ? styles.on : undefined} aria-pressed={!onlyChanged} onClick={() => setOnlyChanged(false)}>Svi artikli</button>
            <button type="button" className={onlyChanged ? styles.on : undefined} aria-pressed={onlyChanged} onClick={() => setOnlyChanged(true)}>Samo promene ({plan.items.length})</button>
          </div>
          <label className={styles.selectLabel}>
            Zaokruživanje
            <select value={rounding} onChange={(e) => setRounding(e.target.value === "dinar" ? "dinar" : "para")}>
              <option value="para">na paru (0,01)</option>
              <option value="dinar">na ceo dinar</option>
            </select>
          </label>
        </div>

        <div className={styles.tablewrap}>
          <table className={styles.table} data-sort="off">
            <thead>
              <tr>
                <th>Brend / grupa / artikal</th>
                <th className={styles.num}>Stara VP</th>
                <th>Promena %</th>
                <th className={styles.num}>Nova VP (bez PDV-a)</th>
              </tr>
            </thead>
            <tbody>
              {useTree
                ? tree.map(({ brand, groups }) => (
                    <Fragment key={brand}>
                      <tr className={styles.brand}>
                        <td>
                          <button type="button" className={styles.tog} onClick={() => toggle(brand)} aria-expanded={isOpen(brand)} aria-label={`${isOpen(brand) ? "Zatvorite" : "Otvorite"} ${brand}`}>{isOpen(brand) ? "▾" : "▸"}</button>
                          {brand}
                          <span className={styles.sub}>{countOf(allIn.brand.get(brand) ?? 0, ARTIKAL)} · {countOf(groups.length, GRUPA)}</span>
                        </td>
                        <td />
                        <td>{pctInput(`b:${brand}`, `Promena u procentima za ceo brend ${brand}`)}</td>
                        <td className={styles.num}><span className={styles.sub}>{changedIn.brand.get(brand) ? `menja se ${changedIn.brand.get(brand)}` : "za ceo brend"}</span></td>
                      </tr>
                      {isOpen(brand)
                        ? groups.map(({ group, list }) => {
                            const gOpen = isOpen(`g|${group}`);
                            return (
                              <Fragment key={group}>
                                <tr className={styles.group}>
                                  <td className={styles.nameGroup}>
                                    <button type="button" className={styles.tog} onClick={() => toggle(`g|${group}`)} aria-expanded={gOpen} aria-label={`${gOpen ? "Zatvorite" : "Otvorite"} ${group}`}>{gOpen ? "▾" : "▸"}</button>
                                    <b>{group}</b>
                                    <span className={styles.sub}>{countOf(allIn.group.get(group) ?? 0, ARTIKAL)}</span>
                                  </td>
                                  <td />
                                  <td>{pctInput(`g:${group}`, `Promena u procentima za grupu ${group}`)}</td>
                                  <td className={styles.num}><span className={styles.sub}>{changedIn.group.get(group) ? `menja se ${changedIn.group.get(group)}` : "za celu grupu"}</span></td>
                                </tr>
                                {gOpen ? list.map((r) => artRow(r, true)) : null}
                              </Fragment>
                            );
                          })
                        : null}
                    </Fragment>
                  ))
                : flat.map((r) => artRow(r, false))}
              {visible.length === 0 ? (
                <tr><td colSpan={4} className={styles.empty}>Nema artikala za ovaj filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!useTree && visible.length > shown ? (
          <div className={styles.more}>
            <button type="button" className="portal-button" data-variant="secondary" onClick={() => setShown((s) => s + PAGE)}>Prikažite još ({visible.length - shown})</button>
          </div>
        ) : null}
        <div className={styles.legend}>
          <span>Procenat: +4 poskupljenje, -2,5 pojeftinjenje. Prednost: tačna cena artikla › procenat artikla › procenat grupe › procenat brenda.</span>
          <span>Grupa sa 0 % ostaje ista i kada ceo brend poskupljuje.</span>
          <span>Promena veća od {LARGE_CHANGE_PERCENT} % je istaknuta crveno — proverite da nije greška u kucanju.</span>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.changes}`} aria-label="Čuvanje">
        <h2>Pregled pre čuvanja</h2>
        {brandEdits.length || groupEdits.length ? (
          <>
            {brandEdits.map(([b, p]) => (
              <div key={`b:${b}`} className={styles.chg}>
                <div><b>Brend {b}</b><span className={styles.sub}>{countOf(allIn.brand.get(b) ?? 0, ARTIKAL)}</span></div>
                <div className={styles.arrow}>{pctText(p)}</div>
                <div className={styles.sub}>menja se {changedIn.brand.get(b) ?? 0}</div>
                <button type="button" className={styles.x} onClick={() => setInput(`b:${b}`, "")}>Uklonite</button>
              </div>
            ))}
            {groupEdits.map(([g, p]) => (
              <div key={`g:${g}`} className={styles.chg}>
                <div><b>{g}</b><span className={styles.sub}>grupa</span></div>
                <div className={styles.arrow}>{pctText(p)}</div>
                <div className={styles.sub}>menja se {changedIn.group.get(g) ?? 0}</div>
                <button type="button" className={styles.x} onClick={() => setInput(`g:${g}`, "")}>Uklonite</button>
              </div>
            ))}
          </>
        ) : null}
        <p className={styles.lead}>
          Menja se {countOf(plan.items.length, ARTIKAL)}
          {Object.keys(edits.articles).length || Object.keys(edits.prices).length ? ` (od toga pojedinačno: ${Object.keys(edits.articles).length + Object.keys(edits.prices).length})` : ""}.
          {plan.ignored.length ? ` ${plan.ignored.length} artikala bez važeće cene se procentom ne menja.` : ""}
          {" "}Čuvanje ne menja cene: pripremu proverava kancelarija, a važenje potvrđuje vlasnik.
        </p>
        <div className={styles.form}>
          <label className={styles.field}>
            Naziv pripreme
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="npr. R-M +4 % od 1.12." maxLength={120} />
          </label>
          <div className={styles.dateBox}>
            <DateField name="vaziOd" label="Predlog: važi od" value={validFrom} onChange={(iso) => setValidFrom(iso)} hint="Konačan datum bira vlasnik." />
          </div>
          <label className={styles.field}>
            Napomena (neobavezno)
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="npr. novi cenovnik dobavljača od 1.12." />
          </label>
          {autosave ? null : <button type="button" className="portal-button" data-variant="secondary" disabled={blocked} onClick={() => save(false)}>Sačuvajte pripremu</button>}
          <button type="button" className="portal-button" data-variant="primary" disabled={blocked} onClick={() => save(true)}>
            {pending ? "Čuva se…" : "Sačuvajte i pošaljite kancelariji"}
          </button>
        </div>
        {bad.size ? <p className={styles.warn}>Neispravan unos u {bad.size} polja (procenat od -90 do +300, cena veća od nule).</p> : null}
        {result ? <div className={result.ok ? styles.ok : styles.err} role="status">{result.text}</div> : null}
        <p className={styles.sub}>Danas: {today.split("-").reverse().join(".")}.</p>
      </section>
    </>
  );
}
