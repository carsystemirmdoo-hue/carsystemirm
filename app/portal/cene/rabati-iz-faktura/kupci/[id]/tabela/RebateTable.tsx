"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import { DateField } from "@/components/portal/DateField";
import { dmy } from "@/lib/ordering/panelFormat.mjs";
import { ARTIKAL, GRUPA, countOf } from "@/lib/ordering/plural.mjs";
import { dominantPercent, netCentsFor, parseAmount, parsePercent, planChanges, rebateForNet, samePercent } from "@/lib/pricing/rebateTable.mjs";
import type { RebateTableRow } from "@/lib/pricing/rebate-table-service";
import { applyRebateTableAction } from "./actions";
import styles from "./RebateTable.module.css";

type Filter = "svi" | "uzima" | "ne";
type View = "stablo" | "ravno";
const PAGE = 200;

const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rsd = (c: number | null) => (c === null ? "—" : money.format(c / 100));
const pct = (p: number | null) => (p === null ? "na upit" : `${String(Math.round(p * 1000) / 1000).replace(".", ",")} %`);
const plus = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Ključ polja: b:BREND, g:GRUPA, a:<id> (rabat) ili n:<id> (neto cena). */
type Inputs = Record<string, string>;

export function RebateTable({
  customerId,
  rows,
  today,
  canPropose,
  canApprove,
  buysLabel = "Uzima (12 meseci)",
}: {
  customerId: string;
  rows: RebateTableRow[];
  today: string;
  canPropose: boolean;
  canApprove: boolean;
  /** Natpis kartice „Uzima“ — sa izabranim periodom „Uzima (u periodu)“ (2026-11-13). */
  buysLabel?: string;
}) {
  const router = useRouter();
  // Podrazumevano SVI artikli u ponudi — i oni koje kupac još ne uzima, da bi im se rabat pripremio unapred (2026-11-10).
  const [filter, setFilter] = useState<Filter>("svi");
  const [brandFilter, setBrandFilter] = useState("svi");
  const [view, setView] = useState<View>("stablo");
  const [q, setQ] = useState("");
  // Otvoreno: brendovi i grupe koje kupac uzima.
  const [open, setOpen] = useState<Set<string>>(() => new Set(rows.filter((r) => r.buysNow).flatMap((r) => [r.brand, `g|${r.group}`])));
  const [inputs, setInputs] = useState<Inputs>({});
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [bulk, setBulk] = useState("");
  const [includeOwn, setIncludeOwn] = useState(false);
  const [from, setFrom] = useState(plus(today, 1));
  const [fromOk, setFromOk] = useState(true);
  const [reason, setReason] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(rows.map((r) => [r.articleId, r])), [rows]);
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))].sort((a, b) => a.localeCompare(b, "sr")), [rows]);

  // Unos → izmene (isti oblik koji proverava server).
  const edits = useMemo(() => {
    const e = { brands: {} as Record<string, number>, groups: {} as Record<string, number>, articles: {} as Record<string, number>, nets: {} as Record<string, number>, includeOwn };
    const bad = new Set<string>();
    for (const [k, v] of Object.entries(inputs)) {
      if (!v.trim()) continue;
      const kind = k.slice(0, 1);
      const id = k.slice(2);
      if (kind === "n") {
        const n = parseAmount(v);
        if (n === null) bad.add(k);
        else e.nets[id] = Math.round(n * 100);
        continue;
      }
      const p = parsePercent(v);
      if (p === null) {
        bad.add(k);
        continue;
      }
      if (kind === "b") e.brands[id] = p;
      else if (kind === "g") e.groups[id] = p;
      else e.articles[id] = p;
    }
    return { edits: e, bad };
  }, [inputs, includeOwn]);

  const plan = useMemo(() => planChanges(rows, edits.edits), [rows, edits]);
  const itemBy = useMemo(() => new Map(plan.items.map((i) => [i.articleId, i])), [plan]);
  const keptBy = useMemo(() => new Set(plan.kept.map((k) => k.articleId)), [plan]);
  const skippedBy = useMemo(() => new Map(plan.skipped.map((s) => [s.articleId, s.reason])), [plan]);

  const needle = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (filter === "uzima" && !r.buysNow) return false;
        if (filter === "ne" && r.buysNow) return false;
        if (brandFilter !== "svi" && r.brand !== brandFilter) return false;
        if (needle && !`${r.name} ${r.code} ${r.group}`.toLowerCase().includes(needle)) return false;
        return true;
      }),
    [rows, filter, brandFilter, needle],
  );

  const tree = useMemo(() => {
    const m = new Map<string, Map<string, RebateTableRow[]>>();
    for (const r of visible) {
      const g = m.get(r.brand) ?? new Map<string, RebateTableRow[]>();
      g.set(r.group, [...(g.get(r.group) ?? []), r]);
      m.set(r.brand, g);
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], "sr")).map(([brand, groups]) => ({
      brand,
      groups: [...groups].sort((a, b) => a[0].localeCompare(b[0], "sr")).map(([group, list]) => ({ group, list })),
    }));
  }, [visible]);

  const allIn = useMemo(() => {
    const brand = new Map<string, RebateTableRow[]>();
    const group = new Map<string, RebateTableRow[]>();
    for (const r of rows) {
      brand.set(r.brand, [...(brand.get(r.brand) ?? []), r]);
      group.set(r.group, [...(group.get(r.group) ?? []), r]);
    }
    return { brand, group };
  }, [rows]);

  // Pretraga i filter otvaraju sve što pogađaju; inače je otvoreno ono što je korisnik otvorio.
  const isOpen = (key: string) => Boolean(needle) || brandFilter !== "svi" || open.has(key);
  const toggle = (key: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });
  const setInput = (key: string, value: string) => {
    setResult(null);
    setInputs((s) => {
      const n = { ...s, [key]: value };
      // Rabat i neto cena istog artikla isključuju jedno drugo.
      if (value.trim() && key.startsWith("a:")) delete n[`n:${key.slice(2)}`];
      if (value.trim() && key.startsWith("n:")) delete n[`a:${key.slice(2)}`];
      if (!value.trim()) delete n[key];
      return n;
    });
  };
  const select = (ids: string[], on: boolean) => setSel((s) => {
    const n = new Set(s);
    for (const id of ids) {
      if (on) n.add(id);
      else n.delete(id);
    }
    return n;
  });
  const applyBulk = () => {
    const p = parsePercent(bulk);
    if (p === null) return;
    setInputs((s) => {
      const n = { ...s };
      for (const id of sel) {
        n[`a:${id}`] = String(p).replace(".", ",");
        delete n[`n:${id}`];
      }
      return n;
    });
    setSel(new Set());
    setBulk("");
  };

  // Spisak promena: po izmeni, sa brojem artikala koji se stvarno menjaju.
  const changes = useMemo(() => {
    const list: { key: string; scope: string; kind: string; change: string; detail: string }[] = [];
    const count = (origin: string) => plan.items.filter((i) => i.origin === origin).length;
    const keptN = (origin: string) => plan.kept.filter((k) => k.origin === origin).length;
    const skipN = (origin: string) => plan.skipped.filter((k) => k.origin === origin).length;
    const wideDetail = (origin: string) => {
      const parts = [`menja se ${countOf(count(origin), ARTIKAL)}`];
      if (keptN(origin)) parts.push(`${keptN(origin)} posebnih dogovora ostaje`);
      if (skipN(origin)) parts.push(`${skipN(origin)} preskočeno`);
      return parts.join(" · ");
    };
    for (const [b, p] of Object.entries(edits.edits.brands)) {
      list.push({ key: `b:${b}`, scope: `Brend ${b}`, kind: "svi artikli brenda", change: `${pct(dominantPercent(allIn.brand.get(b) ?? []))} → ${pct(p)}`, detail: wideDetail(`brend ${b}`) });
    }
    for (const [g, p] of Object.entries(edits.edits.groups)) {
      list.push({ key: `g:${g}`, scope: g, kind: "grupa", change: `${pct(dominantPercent(allIn.group.get(g) ?? []))} → ${pct(p)}`, detail: wideDetail(`grupa ${g}`) });
    }
    for (const id of Object.keys(edits.edits.articles)) {
      const r = byId.get(id);
      const it = itemBy.get(id);
      if (!r) continue;
      list.push({ key: `a:${id}`, scope: r.name, kind: `artikal · ${r.code}`, change: `${pct(r.currentPercent)} → ${pct(edits.edits.articles[id])}`, detail: it ? "menja se 1 artikal" : (skippedBy.get(id) ?? "bez promene") });
    }
    for (const id of Object.keys(edits.edits.nets)) {
      const r = byId.get(id);
      if (!r) continue;
      const d = rebateForNet(r.baseCents, edits.edits.nets[id]);
      list.push({
        key: `n:${id}`,
        scope: r.name,
        kind: `neto cena · ${r.code}`,
        change: d.ok ? `${rsd(r.netCents)} → ${rsd(d.netCents)} (rabat ${pct(d.percent)})` : "—",
        detail: !d.ok ? d.error : d.exact ? (skippedBy.get(id) ?? "menja se 1 artikal") : `tačno ${rsd(edits.edits.nets[id])} rabat ne daje; važiće najbliža ${rsd(d.netCents)}`,
      });
    }
    return list;
  }, [edits, plan, allIn, byId, itemBy, skippedBy]);

  const save = (approveNow: boolean) => {
    const expected: Record<string, string | null> = {};
    for (const it of plan.items) expected[it.articleId] = it.replacesRuleId;
    start(async () => {
      const r = await applyRebateTableAction({ customerId, edits: edits.edits, effectiveFrom: from, reason, approveNow, expected });
      if (r.ok) {
        setInputs({});
        setSel(new Set());
        setReason("");
        setResult({ ok: true, text: r.message });
        router.refresh();
      } else setResult({ ok: false, text: r.error });
    });
  };

  const buysTotal = rows.filter((r) => r.buysNow).length;
  const reasonOk = reason.trim().length >= 10;
  const blockedSave = pending || !plan.items.length || edits.bad.size > 0 || !fromOk || !reasonOk || plan.tooMany;

  const pctInput = (key: string, placeholder: string, label: string) => (
    <span className={styles.pct}>
      <input
        type="text"
        inputMode="decimal"
        className={edits.bad.has(key) ? styles.bad : inputs[key] ? styles.dirty : undefined}
        value={inputs[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => setInput(key, e.target.value)}
        disabled={!canPropose}
        aria-label={label}
      />
      %
    </span>
  );

  const artRow = (r: RebateTableRow, indent: boolean) => {
    const it = itemBy.get(r.articleId);
    const newPct = it?.percent ?? null;
    const changed = newPct !== null && !samePercent(newPct, r.currentPercent);
    const newNet = it ? (it.netCents ?? (r.baseCents !== null ? netCentsFor(r.baseCents, it.percent) : null)) : null;
    const netKey = `n:${r.articleId}`;
    const netDerived = edits.edits.nets[r.articleId] !== undefined ? rebateForNet(r.baseCents, edits.edits.nets[r.articleId]) : null;
    // Poklopac obaveznog para (0056): rabat ide uz posudu, ne bira se posebno.
    const lid = r.pairCodes.length > 0;
    return (
      <tr key={r.articleId} className={`${styles.art} ${sel.has(r.articleId) ? styles.sel : ""} ${r.buysNow ? "" : styles.off}`}>
        <td>
          <input type="checkbox" checked={sel.has(r.articleId)} onChange={(e) => select([r.articleId], e.target.checked)} disabled={!canPropose || lid} aria-label={`Izaberite ${r.name}`} />
        </td>
        <td className={indent ? styles.nameArt : undefined}>
          {r.name}
          <span className={styles.sub}>
            <span className={styles.code}>{r.code}</span> · {r.group}
          </span>
        </td>
        <td>
          <span className={r.buysNow ? styles.yes : styles.no}>{r.buysNow ? `Uzima · ${r.purchaseDays}×` : r.purchaseDays ? "Ranije" : "Ne uzima"}</span>
          <span className={styles.sub}>{r.lastPurchaseOn ? `poslednja ${dmy(r.lastPurchaseOn)}` : "nijedna kupovina"}</span>
        </td>
        <td className={styles.num}>{rsd(r.baseCents)}</td>
        <td>
          {changed ? `${pct(r.currentPercent)} → ${pct(newPct)}` : pct(r.currentPercent)}
          <span className={changed ? styles.srcNew : r.source === "artikal" ? styles.srcOwn : styles.src}>
            {changed ? (it?.netCents !== null && it?.netCents !== undefined ? "nova · iz neto cene" : "nova") : r.source === "artikal" ? "artikal" : r.source === "sire" ? "šire pravilo" : "nije određen"}
          </span>
          {keptBy.has(r.articleId) ? <span className={styles.keep}>poseban dogovor ostaje</span> : null}
          {r.blocked ? <span className={styles.warn}>{r.blocked}</span> : null}
          {lid ? <span className={styles.note}>ide uz posudu {r.pairCodes.join(", ")} — isti rabat</span> : null}
        </td>
        <td>{lid ? <span className={styles.sub}>kao posuda</span> : pctInput(`a:${r.articleId}`, r.currentPercent === null ? "" : String(r.currentPercent).replace(".", ","), `Nov rabat za ${r.name}`)}</td>
        <td className={styles.num}>
          <span className={styles.pct}>
            <input
              type="text"
              inputMode="decimal"
              className={`${styles.netInput} ${edits.bad.has(netKey) || (netDerived && !netDerived.ok) ? styles.bad : inputs[netKey] ? styles.dirty : ""}`}
              value={inputs[netKey] ?? ""}
              placeholder={rsd(newNet ?? r.netCents)}
              onChange={(e) => setInput(netKey, e.target.value)}
              disabled={!canPropose || r.baseCents === null || lid}
              aria-label={`Nova neto cena za ${r.name}`}
            />
          </span>
          {changed && r.netCents !== null ? <span className={styles.sub}>bilo {rsd(r.netCents)}</span> : null}
          {netDerived ? (
            <span className={netDerived.ok && netDerived.exact ? styles.note : styles.noteWarn}>
              {!netDerived.ok ? netDerived.error : netDerived.exact ? `= rabat ${pct(netDerived.percent)}` : `tačno tu cenu rabat ne daje; najbliže ${rsd(netDerived.netCents)} uz ${pct(netDerived.percent)}`}
            </span>
          ) : null}
        </td>
      </tr>
    );
  };

  const flat = view === "ravno" ? visible.slice(0, shown) : [];

  return (
    <>
      <section className={styles.metrics} aria-label="Sažetak">
        <div><span>Artikala u ponudi</span><strong>{rows.length}</strong></div>
        <div><span>{buysLabel}</span><strong>{buysTotal}</strong></div>
        <div><span>Ne uzima</span><strong>{rows.length - buysTotal}</strong></div>
        <div><span>Rabat po artiklu</span><strong>{rows.filter((r) => r.source === "artikal").length}</strong></div>
        <div className={styles.red}><span>Artikala za promenu</span><strong>{plan.items.length}</strong></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input type="search" placeholder="Pretraga: naziv, šifra, grupa (npr. P19)" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} aria-label="Pretraga artikala" />
          </label>
          <div className={styles.seg} role="group" aria-label="Kupovina">
            {([["svi", "Svi"], ["uzima", "Uzima"], ["ne", "Ne uzima"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={filter === k ? styles.on : undefined} aria-pressed={filter === k} onClick={() => { setFilter(k); setShown(PAGE); }}>{l}</button>
            ))}
          </div>
          <label className={styles.selectLabel}>
            Brend
            <select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setShown(PAGE); }}>
              <option value="svi">Svi brendovi</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <div className={styles.seg} role="group" aria-label="Prikaz">
            <button type="button" className={view === "stablo" ? styles.on : undefined} aria-pressed={view === "stablo"} onClick={() => setView("stablo")}>Brend › grupa › artikal</button>
            <button type="button" className={view === "ravno" ? styles.on : undefined} aria-pressed={view === "ravno"} onClick={() => setView("ravno")}>Samo artikli</button>
          </div>
        </div>

        <div className={styles.tablewrap}>
          {/* Stablo brend › grupa › artikal se ne ređa (pomešale bi se grupe); „Samo artikli“ da. */}
          <table className={styles.table} data-sort={view === "stablo" ? "off" : undefined}>
            <thead>
              <tr>
                <th className={styles.check} aria-label="Izbor" />
                <th>Brend / grupa / artikal</th>
                <th>Kupovina</th>
                <th className={styles.num}>VP cena</th>
                <th>Važeći rabat</th>
                <th>Nov rabat</th>
                <th className={styles.num}>Neto cena (bez PDV-a)</th>
              </tr>
            </thead>
            <tbody>
              {view === "stablo"
                ? tree.map(({ brand, groups }) => {
                    const all = allIn.brand.get(brand) ?? [];
                    const ids = groups.flatMap((g) => g.list.map((r) => r.articleId));
                    const dom = dominantPercent(all);
                    const bKey = `b:${brand}`;
                    return (
                      <Fragment key={brand}>
                        <tr className={styles.brand}>
                          <td><input type="checkbox" checked={ids.length > 0 && ids.every((id) => sel.has(id))} onChange={(e) => select(ids, e.target.checked)} disabled={!canPropose} aria-label={`Izaberite artikle brenda ${brand}`} /></td>
                          <td>
                            <button type="button" className={styles.tog} onClick={() => toggle(brand)} aria-expanded={isOpen(brand)} aria-label={`${isOpen(brand) ? "Zatvorite" : "Otvorite"} ${brand}`}>{isOpen(brand) ? "▾" : "▸"}</button>
                            {brand}
                            <span className={styles.sub}>{countOf(all.length, ARTIKAL)} · {countOf(groups.length, GRUPA)}</span>
                          </td>
                          <td>uzima {all.filter((r) => r.buysNow).length} od {all.length}</td>
                          <td />
                          <td>{dom === null ? "na upit" : `najčešće ${pct(dom)}`}</td>
                          <td>{pctInput(bKey, dom === null ? "" : String(dom).replace(".", ","), `Nov rabat za ceo brend ${brand}`)}</td>
                          <td className={styles.num}><span className={styles.sub}>za ceo brend</span></td>
                        </tr>
                        {isOpen(brand)
                          ? groups.map(({ group, list }) => {
                              const gAll = allIn.group.get(group) ?? [];
                              const gIds = list.map((r) => r.articleId);
                              const gDom = dominantPercent(gAll);
                              const gKey = `g:${group}`;
                              const gOpen = isOpen(`g|${group}`);
                              return (
                                <Fragment key={group}>
                                  <tr className={styles.group}>
                                    <td><input type="checkbox" checked={gIds.every((id) => sel.has(id))} onChange={(e) => select(gIds, e.target.checked)} disabled={!canPropose} aria-label={`Izaberite artikle grupe ${group}`} /></td>
                                    <td className={styles.nameGroup}>
                                      <button type="button" className={styles.tog} onClick={() => toggle(`g|${group}`)} aria-expanded={gOpen} aria-label={`${gOpen ? "Zatvorite" : "Otvorite"} ${group}`}>{gOpen ? "▾" : "▸"}</button>
                                      <b>{group}</b>
                                      <span className={styles.sub}>{countOf(gAll.length, ARTIKAL)}</span>
                                    </td>
                                    <td>uzima {gAll.filter((r) => r.buysNow).length} od {gAll.length}</td>
                                    <td />
                                    <td>{gDom === null ? "na upit" : `najčešće ${pct(gDom)}`}</td>
                                    <td>{pctInput(gKey, gDom === null ? "" : String(gDom).replace(".", ","), `Nov rabat za grupu ${group}`)}</td>
                                    <td className={styles.num}><span className={styles.sub}>za celu grupu</span></td>
                                  </tr>
                                  {gOpen ? list.map((r) => artRow(r, true)) : null}
                                </Fragment>
                              );
                            })
                          : null}
                      </Fragment>
                    );
                  })
                : flat.map((r) => artRow(r, false))}
              {visible.length === 0 ? (
                <tr><td colSpan={7} className={styles.empty}>Nema artikala za ovaj filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {view === "ravno" && visible.length > shown ? (
          <div className={styles.more}>
            <button type="button" className="portal-button" data-variant="secondary" onClick={() => setShown((s) => s + PAGE)}>
              Prikažite još ({visible.length - shown})
            </button>
          </div>
        ) : null}
        <div className={styles.legend}>
          <span><span className={styles.src}>šire pravilo</span> rabat brenda ili kupca</span>
          <span><span className={styles.srcOwn}>artikal</span> rabat tog artikla — grupna promena ne dira poseban dogovor</span>
          <span><span className={styles.srcNew}>nova</span> promena koja još nije sačuvana</span>
          <span>Neto cena se upisuje po artiklu; rabat se iz nje računa tako da faktura u BizniSoftu da tačno tu cenu (rabat na 3 decimale, pola pare naniže).</span>
        </div>
      </section>

      {sel.size > 0 && canPropose ? (
        <div className={styles.bulk} role="region" aria-label="Grupna izmena">
          <b>Izabrano: {countOf(sel.size, ARTIKAL)}</b>
          <label>
            Postavite rabat
            <input type="text" inputMode="decimal" value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Rabat za izabrane artikle" /> %
          </label>
          <button type="button" className="portal-button" data-variant="primary" disabled={parsePercent(bulk) === null} onClick={applyBulk}>Primenite na izabrane</button>
          <button type="button" className={styles.ghost} onClick={() => setSel(new Set())}>Poništite izbor</button>
        </div>
      ) : null}

      <section className={`${styles.panel} ${styles.changes}`} aria-label="Promene">
        <h2>Promene ({changes.length})</h2>
        <p className={styles.lead}>Pre čuvanja: šta se menja, sa koliko na koliko i na koliko artikala. Vlasnik svaku sačuvanu promenu vidi u „Promene komercijalista“.</p>
        {!canPropose ? <p className={styles.lead}>Rabate ovog kupca možete samo da pregledate.</p> : null}
        {changes.length === 0 && canPropose ? (
          <p className={styles.lead}>Nema promena. Upišite nov rabat za ceo brend, grupu ili artikal, neto cenu artikla, ili čekirajte artikle i postavite im rabat zajedno.</p>
        ) : null}
        {changes.map((c) => (
          <div key={c.key} className={styles.chg}>
            <div><b>{c.scope}</b><span className={styles.sub}>{c.kind}</span></div>
            <div className={styles.arrow}>{c.change}</div>
            <div className={styles.sub}>{c.detail}</div>
            <button type="button" className={styles.x} onClick={() => setInput(c.key, "")}>Uklonite</button>
          </div>
        ))}
        {plan.kept.length ? (
          <label className={styles.includeOwn}>
            <input type="checkbox" checked={includeOwn} onChange={(e) => setIncludeOwn(e.target.checked)} />
            Uključite i posebne dogovore ({plan.kept.length}) u promenu grupe ili brenda
          </label>
        ) : null}
        {plan.tooMany ? <p className={styles.warn}>Previše artikala u jednom čuvanju ({plan.items.length}). Sačuvajte u delovima, npr. po grupi.</p> : null}
        {changes.length && canPropose ? (
          <div className={styles.form}>
            <div className={styles.dateBox}>
              <DateField name="vaziOd" label="Važi od" value={from} onChange={(iso, ok) => { setFrom(iso); setFromOk(ok && iso >= today); }} error={fromOk ? undefined : "Datum ne sme biti u prošlosti."} />
            </div>
            <label className={styles.field}>
              Obrazloženje (vidi ga vlasnik, najmanje 10 znakova)
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. dogovor sa kupcem za 2027" maxLength={600} />
            </label>
            <button type="button" className="portal-button" data-variant="secondary" disabled={blockedSave} onClick={() => save(false)}>Sačuvajte kao predlog</button>
            {canApprove ? (
              <button type="button" className="portal-button" data-variant="primary" disabled={blockedSave} onClick={() => save(true)}>
                {pending ? "Čuva se…" : "Odobrite odmah"}
              </button>
            ) : null}
          </div>
        ) : null}
        {result ? <div className={result.ok ? styles.ok : styles.err} role="status">{result.text}</div> : null}
      </section>
    </>
  );
}
