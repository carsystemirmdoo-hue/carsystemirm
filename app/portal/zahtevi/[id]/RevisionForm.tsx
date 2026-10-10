"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { proposeRevisionAction } from "../actions";

type Line = { code: string; name: string; unit: string; quantity: string };

/**
 * Izmenjen predlog kancelarije: roba i količine. Cene se računaju na serveru po
 * važećim odobrenim uslovima i istoj opciji plaćanja. Original ostaje sačuvan;
 * kupac predlog potvrđuje ili odbija.
 */
export function RevisionForm({ orderId, lines }: { orderId: string; lines: Line[] }) {
  const [rows, setRows] = useState<Line[]>(lines);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; orderId?: string } | null>(null);
  if (msg?.ok) return <p className="portal-permission-ok" role="status">{msg.text} <Link href={`/portal/zahtevi/${msg.orderId}`}>Otvorite predlog</Link></p>;
  return (
    <details className="rc-unclear">
      <summary>Pripremite izmenjen predlog (kupac ga potvrđuje)</summary>
      <div className="rc-change">
        <table className="portal-table rr-table">
          <thead><tr><th scope="col">Šifra</th><th scope="col">Naziv</th><th scope="col">Količina</th><th scope="col" /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.code}-${i}`}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td><input aria-label={`Količina ${r.code}`} value={r.quantity} inputMode="decimal" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /> <small>{r.unit}</small></td>
                <td><button type="button" className="portal-button" data-variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Uklonite</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rc-inline">
          <label className="rr-field rr-field-short"><span>Dodajte šifru</span><input value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <label className="rr-field rr-field-short"><span>Količina</span><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" /></label>
          <button type="button" className="portal-button" data-variant="secondary" disabled={!code.trim()} onClick={() => { setRows([...rows, { code: code.trim(), name: "(novo)", unit: "", quantity: qty }]); setCode(""); }}>Dodajte</button>
        </div>
        <label className="rr-field"><span>Razlog izmene (vidi ga kupac)</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. artikal 531206 trenutno nije na stanju — predlog zamene" /></label>
        <button type="button" className="portal-button" disabled={pending || reason.trim().length < 5 || !rows.length}
          onClick={() => start(async () => { const r = await proposeRevisionAction(orderId, rows.map((x) => ({ code: x.code, quantity: x.quantity })), reason); setMsg(r.ok ? { ok: true, text: r.message, orderId: (r as { orderId?: string }).orderId } : { ok: false, text: r.message }); })}>
          {pending ? "Šaljem…" : "Pošaljite izmenjen predlog kupcu"}
        </button>
        {msg && !msg.ok ? <p className="portal-login-error" role="alert">{msg.text}</p> : null}
      </div>
    </details>
  );
}
