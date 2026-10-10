"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { previewRevisionAction, proposeRevisionAction, searchRevisionArticlesAction } from "../actions";

type Line = { code: string; name: string; unit: string; quantity: string };
type Preview = Extract<Awaited<ReturnType<typeof previewRevisionAction>>, { ok: true }>;
type Found = { code: string; name: string; unit: string };

const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Izmenjen predlog kancelarije: roba i količine. Cene se računaju na serveru po
 * važećim odobrenim uslovima i istoj opciji plaćanja — kancelarija ih ne upisuje
 * ručno. Original ostaje sačuvan; kupac predlog potvrđuje ili odbija.
 */
export function RevisionForm({ orderId, lines, rebatesHref }: { orderId: string; lines: Line[]; rebatesHref: string | null }) {
  const [rows, setRows] = useState<Line[]>(lines);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; orderId?: string } | null>(null);

  const change = (next: Line[]) => {
    setRows(next);
    setPreview(null);
  };
  const search = () =>
    start(async () => {
      const r = await searchRevisionArticlesAction(orderId, query);
      if (r.ok) setFound(r.items);
      else setMsg({ ok: false, text: r.message });
    });
  const check = () =>
    start(async () => {
      const r = await previewRevisionAction(orderId, rows.map((x) => ({ code: x.code, quantity: x.quantity })));
      if (r.ok) {
        setPreview(r);
        setMsg(null);
      } else setMsg({ ok: false, text: r.message });
    });

  if (msg?.ok) {
    return (
      <p className="portal-permission-ok" role="status">
        {msg.text} <Link href={`/portal/zahtevi/${msg.orderId}`}>Otvorite predlog</Link>
      </p>
    );
  }
  const byCode = new Map((preview?.lines ?? []).map((l) => [l.code, l]));
  const blocked = preview?.lines.some((l) => l.problem);
  return (
    <details className="rc-unclear">
      <summary>Pripremite izmenjen predlog (kupac ga potvrđuje)</summary>
      <div className="rc-change">
        <p className="kk-fine">
          Menjate robu i količine. Cene računa sistem po odobrenim uslovima kupca i opciji plaćanja iz zahteva; ručni unos
          cene ne postoji. Za stavku na upit cena se pojavljuje tek kada vlasnik odobri rabat
          {rebatesHref ? (
            <>
              {" "}
              (<Link href={rebatesHref}>Rabati kupca</Link>)
            </>
          ) : null}
          ; zatim ponovo proverite cene.
        </p>
        <div className="rv-scroll">
          <table className="portal-table rr-table rv-table">
            <thead>
              <tr>
                <th scope="col">Šifra</th>
                <th scope="col">Naziv</th>
                <th scope="col">Količina</th>
                <th scope="col">Cena (proveriti)</th>
                <th scope="col">
                  <span className="sr-only">Radnja</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const p = byCode.get(r.code);
                return (
                  <tr key={`${r.code}-${i}`}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td className="rv-qty">
                      <input
                        aria-label={`Količina ${r.code}`}
                        value={r.quantity}
                        inputMode="decimal"
                        onChange={(e) => change(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                      />{" "}
                      <small>{r.unit}</small>
                    </td>
                    <td>
                      {!p ? (
                        <small>—</small>
                      ) : p.problem ? (
                        <span className="kk-problem">{p.problem}</span>
                      ) : p.status === "na_upit" ? (
                        <>
                          Na upit<small>{p.note}</small>
                        </>
                      ) : (
                        <>
                          {money.format(p.netPrice ?? 0)} RSD<small>rabat {p.discountPercent} % · sa PDV-om {money.format(p.gross ?? 0)}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <button type="button" className="portal-button" data-variant="ghost" onClick={() => change(rows.filter((_, j) => j !== i))}>
                        Uklonite
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rc-inline">
          <label className="rr-field">
            <span>Dodajte artikal — šifra ili naziv</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
            />
          </label>
          <button type="button" className="portal-button" data-variant="secondary" disabled={pending || query.trim().length < 2} onClick={search}>
            Pronađite
          </button>
        </div>
        {found ? (
          found.length ? (
            <ul className="rv-found">
              {found.map((f) => (
                <li key={f.code}>
                  <span>
                    <strong>{f.code}</strong> {f.name} <small>{f.unit}</small>
                  </span>
                  <button
                    type="button"
                    className="portal-button"
                    data-variant="secondary"
                    onClick={() => {
                      change([...rows, { code: f.code, name: f.name, unit: f.unit, quantity: "1" }]);
                      setFound(null);
                      setQuery("");
                    }}
                  >
                    Dodajte
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kk-fine">Nema artikla za „{query}“.</p>
          )
        ) : null}
        <label className="rr-field">
          <span>Razlog izmene (vidi ga kupac)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. artikal 531206 trenutno nije na stanju — predlog zamene" />
        </label>
        {preview ? (
          <p className="kk-fine" role="status">
            Zbir sa PDV-om: <strong>{money.format(preview.gross)} RSD</strong>
            {preview.onRequest ? ` · stavke na upit: ${preview.onRequest} (nisu u zbiru)` : ""}
          </p>
        ) : null}
        <div className="kk-step-actions">
          <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !rows.length} onClick={check}>
            Proverite cene
          </button>
          <button
            type="button"
            className="portal-button"
            disabled={pending || !preview || blocked || reason.trim().length < 5 || !rows.length}
            title={!preview ? "Prvo proverite cene" : undefined}
            onClick={() =>
              start(async () => {
                const r = await proposeRevisionAction(orderId, rows.map((x) => ({ code: x.code, quantity: x.quantity })), reason);
                setMsg(r.ok ? { ok: true, text: r.message, orderId: (r as { orderId?: string }).orderId } : { ok: false, text: r.message });
              })
            }
          >
            {pending ? "Šaljem…" : "Pošaljite izmenjen predlog kupcu"}
          </button>
        </div>
        {msg && !msg.ok ? (
          <p className="portal-login-error" role="alert">
            {msg.text}
          </p>
        ) : null}
      </div>
    </details>
  );
}
