"use client";

import { useState, useTransition } from "react";
import { COMMERCIAL_STATUSES } from "@/lib/customers/commercial-status.mjs";
import type { CommercialStatus } from "@/lib/customers/commercial-status-service";
import { setCommercialStatusAction } from "./status-actions";

export function CommercialStatusForm({ customerId, current }: { customerId: string; current: CommercialStatus }) {
  const [status, setStatus] = useState<CommercialStatus>(current);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="rc-change">
      <label className="rr-field">
        <span>Poseban poslovni status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as CommercialStatus)}>
          {Object.entries(COMMERCIAL_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="rr-field">
        <span>Obrazloženje</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. uslovi zavise od međusobnog prebijanja" />
      </label>
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending || status === current || reason.trim().length < 5}
        onClick={() => start(async () => setMsg(await setCommercialStatusAction(customerId, status, reason)))}>
        {pending ? "Čuvam…" : "Sačuvajte status"}
      </button>
      {msg ? <p className={msg.ok ? "portal-permission-ok" : "portal-login-error"} role="status">{msg.message}</p> : null}
    </div>
  );
}
