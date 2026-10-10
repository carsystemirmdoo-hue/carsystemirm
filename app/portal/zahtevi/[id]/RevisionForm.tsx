"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { amount, money, percent } from "@/lib/ordering/panelFormat.mjs";
import { previewRevisionAction, proposeRevisionAction, searchRevisionArticlesAction } from "../actions";

type Line = { code: string; name: string; unit: string; quantity: string };
type Row = Line & { original: string | null; removed: boolean };
type Preview = Extract<Awaited<ReturnType<typeof previewRevisionAction>>, { ok: true }>;
type Found = { code: string; name: string; unit: string };

/**
 * Izmenjen predlog kancelarije: roba i količine. Cene se računaju na serveru po
 * važećim odobrenim uslovima i istoj opciji plaćanja — kancelarija ih ne upisuje
 * ručno. Original ostaje sačuvan; kupac predlog potvrđuje ili odbija.
 */
export function RevisionForm({
  orderId,
  lines,
  rebatesHref,
  version,
  originalGross = null,
}: {
  orderId: string;
  lines: Line[];
  rebatesHref: string | null;
  version: string;
  /** Ukupno sa PDV-om zahteva koji se menja (poređenje). `null` kada je sve na upit. */
  originalGross?: number | null;
}) {
  const initial: Row[] = lines.map((l) => ({ ...l, original: l.quantity, removed: false }));
  const [rows, setRows] = useState<Row[]>(initial);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; orderId?: string; stale?: { currentId: string; currentNumber: string } } | null>(null);
  const active = rows.filter((r) => !r.removed);
  const changedCount = rows.filter((r) => r.removed || r.original === null || r.quantity.trim() !== r.original).length;
  const dirty = reason.trim() !== "" || query.trim() !== "" || changedCount > 0;

  const change = (next: Row[]) => {
    setRows(next);
    setPreview(null);
  };
  const search = () =>
    start(async () => {
      setBusy("search");
      const r = await searchRevisionArticlesAction(orderId, query);
      setBusy(null);
      if (r.ok) setFound(r.items);
      else setMsg({ ok: false, text: r.message });
    });
  const check = () =>
    start(async () => {
      setBusy("check");
      const r = await previewRevisionAction(orderId, active.map((x) => ({ code: x.code, quantity: x.quantity })));
      setBusy(null);
      if (r.ok) {
        setPreview(r);
        setMsg(null);
      } else setMsg({ ok: false, text: r.message });
    });
  const send = () =>
    start(async () => {
      setBusy("send");
      const r = await proposeRevisionAction(orderId, active.map((x) => ({ code: x.code, quantity: x.quantity })), reason, version);
      setBusy(null);
      setMsg(r.ok ? { ok: true, text: r.message, orderId: (r as { orderId?: string }).orderId } : { ok: false, text: r.message, stale: (r as { stale?: { currentId: string; currentNumber: string } }).stale });
    });

  if (msg?.ok) {
    return (
      <div className="pn-note" data-tone="success" role="status">
        <div className="pn-note-row">
          <span>{msg.text}</span>
          <Link href={`/portal/zahtevi/${msg.orderId}`} className="pn-btn" data-size="sm">
            Otvorite predlog
          </Link>
        </div>
      </div>
    );
  }
  const byCode = new Map((preview?.lines ?? []).map((l) => [l.code, l]));
  const blocked = preview?.lines.some((l) => l.problem);
  const why = !active.length
    ? "Predlog mora imati bar jednu stavku."
    : !preview
      ? "Prvo proverite cene — dugme za slanje se uključuje posle provere."
      : blocked
        ? "Neke stavke imaju problem (označeno u tabeli). Ispravite količinu ili uklonite stavku, pa ponovo proverite cene."
        : reason.trim().length < 5
          ? "Upišite razlog izmene za kupca (najmanje 5 znakova)."
          : null;

  return (
    <details className="pn-card pn-card-flush" id="izmena" data-unsaved={dirty ? "true" : undefined} open={dirty || undefined}>
      <summary className="pn-card-h" style={{ cursor: "pointer", minHeight: 48 }}>
        <h2 style={{ display: "inline" }}>Izmenjen predlog za kupca</h2>
        <span className="pn-inline">
          <span className="pn-small pn-muted">Roba i količine · kupac potvrđuje · original ostaje sačuvan</span>
          <span className="pn-btn" data-size="sm" aria-hidden="true">
            <span className="pn-disclose-closed">Otvorite ▾</span>
            <span className="pn-disclose-open">Zatvorite ▴</span>
          </span>
        </span>
      </summary>
      <div style={{ padding: "12px 16px 0" }}>
        <p className="pn-small pn-muted" style={{ maxWidth: "90ch" }}>
          Menjate robu i količine. Cene računa sistem po odobrenim uslovima kupca i opciji plaćanja iz zahteva; ručni unos cene ne postoji. Za stavku na upit
          cena se pojavljuje tek kada vlasnik odobri rabat
          {rebatesHref ? (
            <>
              {" "}
              (<Link href={rebatesHref}>Rabati kupca</Link>)
            </>
          ) : null}
          ; zatim ponovo proverite cene.
        </p>
      </div>
      <div style={{ paddingTop: 12 }}>
        <ScrollTable label="Stavke izmenjenog predloga">
          <table className="pn-table pn-table-cards pn-table-sticky" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 96 }}>Šifra</th>
                <th scope="col">Naziv</th>
                <th scope="col" className="pn-r" style={{ width: 70 }}>Bilo</th>
                <th scope="col" className="pn-r" style={{ width: 150 }}>Količina</th>
                <th scope="col" className="pn-r" style={{ width: 170 }}>
                  Cena kupca / JM <span className="pn-th-sub">bez PDV-a</span>
                </th>
                <th scope="col" className="pn-r" style={{ width: 130 }}>
                  Iznos <span className="pn-th-sub">bez PDV-a</span>
                </th>
                <th scope="col" className="pn-r" style={{ width: 130 }}>
                  Ukupno <span className="pn-th-sub">sa PDV-om</span>
                </th>
                <th scope="col" style={{ width: 100 }}>
                  <span className="pn-sr">Radnja</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const p = r.removed ? undefined : byCode.get(r.code);
                const qtyChanged = !r.removed && r.original !== null && r.quantity.trim() !== r.original;
                const tone = r.removed ? "removed" : r.original === null ? "added" : qtyChanged ? "warning" : undefined;
                return (
                  <tr key={`${r.code}-${i}`} data-tone={tone}>
                    <td className="pn-c-code">{r.code}</td>
                    <td className="pn-c-name">
                      <span className="pn-strong">{r.name}</span>
                      {r.removed ? <span className="pn-tag" data-tone="danger">Uklonjeno iz predloga</span> : null}
                      {r.original === null ? <span className="pn-tag" data-tone="success">Dodato</span> : null}
                    </td>
                    <td className="pn-r pn-num pn-muted" data-label="Bilo">
                      {r.original === null ? "—" : `${r.original.replace(".", ",")}`}
                    </td>
                    <td className="pn-r" data-label={`Količina (${r.unit || "JM"})`}>
                      {r.removed ? (
                        <span className="pn-muted">—</span>
                      ) : (
                        <span className="pn-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <input
                            className="pn-input pn-qty"
                            aria-label={`Količina, ${r.code} ${r.name} (${r.unit || "JM"})`}
                            value={r.quantity}
                            inputMode="decimal"
                            onChange={(e) => change(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                          />
                          <span className="pn-muted pn-small" style={{ minWidth: 28 }}>{r.unit}</span>
                        </span>
                      )}
                    </td>
                    <td className="pn-r" data-label="Cena kupca / JM">
                      {r.removed ? (
                        <span className="pn-muted">—</span>
                      ) : !p ? (
                        <span className="pn-muted pn-small">proverite cene</span>
                      ) : p.problem ? (
                        <span className="pn-error" style={{ justifyContent: "flex-end" }}>{p.problem}</span>
                      ) : p.status === "na_upit" ? (
                        <>
                          <span className="pn-onreq">Na upit</span>
                          <span className="pn-sub">{p.note}</span>
                        </>
                      ) : (
                        <>
                          <span className="pn-num">
                            {amount(p.netPrice)} <span className="pn-muted">/ {r.unit || "JM"}</span>
                          </span>
                          <span className="pn-sub pn-num">osnovna {amount(p.listPrice)}</span>
                          <span className="pn-sub pn-num">rabat {percent(p.discountPercent ?? 0)}</span>
                        </>
                      )}
                    </td>
                    <td className="pn-r pn-num" data-label="Iznos bez PDV-a">
                      {!p || p.problem || p.status === "na_upit" ? <span className="pn-muted">—</span> : amount(p.net)}
                    </td>
                    <td className="pn-r pn-num pn-strong pn-c-total" data-label="Ukupno sa PDV-om">
                      {!p || p.problem ? <span className="pn-muted">—</span> : p.status === "na_upit" ? <span className="pn-muted" style={{ fontWeight: 400 }}>nije utvrđen</span> : amount(p.gross)}
                    </td>
                    <td className="pn-c-actions">
                      {r.removed ? (
                        <button type="button" className="pn-btn" data-variant="quiet" data-size="sm" onClick={() => change(rows.map((x, j) => (j === i ? { ...x, removed: false } : x)))}>
                          Vratite
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pn-btn"
                          data-variant="quiet"
                          data-size="sm"
                          style={{ color: "var(--pn-danger)" }}
                          aria-label={`Uklonite ${r.code} ${r.name}`}
                          onClick={() => change(r.original === null ? rows.filter((_, j) => j !== i) : rows.map((x, j) => (j === i ? { ...x, removed: true } : x)))}
                        >
                          Uklonite
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 16, borderTop: "1px solid var(--p-line)" }}>
        <div className="pn-filters">
          <div className="pn-field">
            <label htmlFor={`trazi-${orderId}`}>Dodajte artikal — šifra ili naziv</label>
            <input
              id={`trazi-${orderId}`}
              value={query}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (query.trim().length >= 2) search();
                }
              }}
            />
          </div>
          <button type="button" className="pn-btn" disabled={pending || query.trim().length < 2} aria-busy={busy === "search" || undefined} onClick={search}>
            {busy === "search" ? "Traži se…" : "Pronađite"}
          </button>
          {query.trim().length > 0 && query.trim().length < 2 ? <span className="pn-why">Upišite bar 2 znaka.</span> : null}
        </div>
        {found ? (
          found.length ? (
            <ul className="pn-versions" aria-label="Pronađeni artikli">
              {found.map((f) => (
                <li key={f.code}>
                  <span>
                    <span className="pn-vname">{f.code}</span> {f.name} <span className="pn-muted pn-small">{f.unit}</span>
                  </span>
                  <button
                    type="button"
                    className="pn-btn"
                    data-size="sm"
                    disabled={rows.some((x) => x.code === f.code && !x.removed)}
                    onClick={() => {
                      const existing = rows.findIndex((x) => x.code === f.code);
                      if (existing >= 0) change(rows.map((x, j) => (j === existing ? { ...x, removed: false } : x)));
                      else change([...rows, { code: f.code, name: f.name, unit: f.unit, quantity: "1", original: null, removed: false }]);
                      setFound(null);
                      setQuery("");
                    }}
                  >
                    {rows.some((x) => x.code === f.code && !x.removed) ? "Već u predlogu" : "Dodajte"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pn-why">Nema artikla za „{query}“. Proverite šifru ili probajte deo naziva.</p>
          )
        ) : null}

        <div className="pn-split" style={{ alignItems: "start" }}>
          <div className="pn-field pn-form-width">
            <label htmlFor={`razlog-${orderId}`}>
              Razlog izmene <small>(vidi ga kupac; najmanje 5 znakova)</small>
            </label>
            <textarea id={`razlog-${orderId}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="npr. artikal 531206 trenutno nije na stanju — predlog zamene" />
          </div>
          <div className="pn-card" style={{ background: "var(--p-surface-subtle)" }} aria-live="polite">
            <h3 className="pn-h3">Zbir predloga</h3>
            {!preview ? (
              <p className="pn-small pn-muted">Zbir se prikazuje posle provere cena.</p>
            ) : preview.onRequest >= preview.lines.length ? (
              <p className="pn-unknown">Iznos još nije utvrđen</p>
            ) : (
              <dl className="pn-totals">
                {originalGross !== null ? (
                  <>
                    <dt>Zahtev koji se menja (sa PDV-om)</dt>
                    <dd>{money(originalGross)}</dd>
                  </>
                ) : null}
                <dt>Iznos bez PDV-a</dt>
                <dd>{money(preview.net)}</dd>
                <dt>PDV</dt>
                <dd>{money(preview.vat)}</dd>
                <dt className="pn-grand">{preview.onRequest ? "Zbir sa PDV-om — nije konačan" : "Predlog sa PDV-om"}</dt>
                <dd className="pn-grand">{money(preview.gross)}</dd>
              </dl>
            )}
            {preview?.onRequest && preview.onRequest < preview.lines.length ? <p className="pn-totals-note">Stavke na upit ({preview.onRequest}) nisu uračunate.</p> : null}
          </div>
        </div>
      </div>

      <div className="pn-no-print" style={{ position: "sticky", bottom: 0, zIndex: 5, display: "grid", gap: 6, padding: "12px 16px", borderTop: "1px solid var(--p-line-strong)", background: "var(--p-surface)" }}>
        <div className="pn-actions">
          <span className="pn-small pn-muted" style={{ marginRight: "auto" }}>
            {changedCount ? `Izmena u odnosu na zahtev: ${changedCount}` : "Još nema izmena u odnosu na zahtev"} · predlog ide kupcu na potvrdu, ne u BizniSoft
          </span>
          <button type="button" className="pn-btn" disabled={pending || !active.length} aria-busy={busy === "check" || undefined} onClick={check}>
            {busy === "check" ? "Proverava se…" : preview ? "Ponovo proverite cene" : "Proverite cene"}
          </button>
          <button type="button" className="pn-btn" data-variant="primary" disabled={pending || Boolean(why)} aria-busy={busy === "send" || undefined} aria-describedby={why ? `zasto-${orderId}` : undefined} onClick={send}>
            {busy === "send" ? "Šalje se…" : "Pošaljite izmenjen predlog kupcu"}
          </button>
        </div>
        {why ? (
          <p id={`zasto-${orderId}`} className="pn-why" style={{ textAlign: "right" }}>
            {why}
          </p>
        ) : null}
        {msg && !msg.ok ? (
          <div className="pn-note" data-tone="danger" role="alert">
            <div className="pn-note-row">
              <span>{msg.text}</span>
              {msg.stale ? (
                <a href={`/portal/zahtevi/${msg.stale.currentId}`} className="pn-btn" data-size="sm">
                  Otvorite aktuelnu verziju{msg.stale.currentNumber ? ` (${msg.stale.currentNumber})` : ""}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
