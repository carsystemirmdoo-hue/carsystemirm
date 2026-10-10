"use client";

import { useState, useTransition } from "react";
import { DateField } from "@/components/portal/DateField";
import type { PaymentOptionRow } from "@/lib/pricing/payment-option-service";
import { decideOptionAction, proposeOptionAction } from "./option-actions";

const STATUS: Record<PaymentOptionRow["status"], { label: string; tone: string }> = {
  predlog: { label: "čeka odobrenje", tone: "warning" },
  odobreno: { label: "odobreno", tone: "success" },
  odbijeno: { label: "odbijeno", tone: "neutral" },
  opozvano: { label: "opozvano", tone: "neutral" },
};

/** Opcije plaćanja kupca: istorija, predlog komercijaliste, odluka vlasnika. */
export function PaymentOptionsPanel({ customerId, rows, canPropose, canApprove, today }: { customerId: string; rows: PaymentOptionRow[]; canPropose: boolean; canApprove: boolean; today: string }) {
  const [kind, setKind] = useState("odlozeno_30");
  const [days, setDays] = useState("15");
  const [from, setFrom] = useState(today);
  const [reason, setReason] = useState("");
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const code = kind === "drugi" ? `odlozeno_${Number(days) || 0}` : kind;
  return (
    <div className="rc-change">
      {rows.length ? (
        <div className="portal-table-wrap">
          <table className="portal-table rr-table">
            <thead>
              <tr>
                <th scope="col">Opcija</th>
                <th scope="col">Stanje</th>
                <th scope="col">Važi</th>
                <th scope="col">Obrazloženje</th>
                <th scope="col">Odluka</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.label}</th>
                  <td data-label="Stanje"><span className="kk-status" data-tone={STATUS[r.status].tone}>{STATUS[r.status].label}</span></td>
                  <td data-label="Važi">od {r.effectiveFrom}{r.effectiveTo ? ` do ${r.effectiveTo}` : ""}</td>
                  <td data-label="Obrazloženje">{r.reason}<small>predložio {r.proposedBy}{r.decidedBy ? ` · odlučio ${r.decidedBy}` : ""}{r.decisionReason ? ` · ${r.decisionReason}` : ""}</small></td>
                  <td data-label="Odluka">
                    {canApprove && r.status === "predlog" ? (
                      <span className="rb-propose">
                        <button type="button" className="portal-button" disabled={pending} onClick={() => start(async () => setMsg(await decideOptionAction(customerId, r.id, "odobreno", null)))}>Odobrite</button>
                        <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !why.trim()} onClick={() => start(async () => setMsg(await decideOptionAction(customerId, r.id, "odbijeno", why)))}>Odbijte</button>
                      </span>
                    ) : null}
                    {canApprove && r.status === "odobreno" && !r.effectiveTo ? (
                      <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !why.trim()} onClick={() => start(async () => setMsg(await decideOptionAction(customerId, r.id, "opozvano", why)))}>Opozovite</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="portal-data-note">Kupcu nije odobrena nijedna opcija plaćanja — vidi jednu cenu po osnovnom uslovu, a plaćanje dogovara sa kancelarijom.</p>
      )}
      {canApprove ? (
        <label className="rr-field">
          <span>Razlog odbijanja ili opoziva</span>
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="obavezno za odbijanje i opoziv" />
        </label>
      ) : null}
      {canPropose ? (
        <fieldset className="rc-modes">
          <legend>Predlog nove opcije</legend>
          <label className="rr-field">
            <span>Opcija</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="avans">Avansno plaćanje</option>
              <option value="odlozeno_30">Odloženo plaćanje — 30 dana</option>
              <option value="drugi">Drugi rok (dana)</option>
            </select>
          </label>
          {kind === "drugi" ? (
            <label className="rr-field rr-field-short">
              <span>Dana</span>
              <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </label>
          ) : null}
          <DateField name="opcijaOd" label="Važi od" value={from} onChange={(iso) => setFrom(iso)} required />
          <label className="rr-field">
            <span>Obrazloženje</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. dogovor sa kupcem o avansnom plaćanju" />
          </label>
          <button type="button" className="portal-button" data-variant="secondary" disabled={pending || reason.trim().length < 5}
            onClick={() => start(async () => setMsg(await proposeOptionAction(customerId, code, from, reason)))}>
            {pending ? "Šaljem…" : "Predložite opciju"}
          </button>
        </fieldset>
      ) : null}
      <p className="portal-data-note">Izbor opcije nije dokaz uplate. Avansna cena važi uz uplatu pre isporuke — kancelarija proverava uplatu pre potvrde isporuke.</p>
      {msg ? <p className={msg.ok ? "portal-permission-ok" : "portal-login-error"} role="status">{msg.message}</p> : null}
    </div>
  );
}
