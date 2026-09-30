"use client";

import { useState, useTransition } from "react";
import { proposeRebateAction } from "./actions";

export function ProposeRebateButton({ customerId, productGroup }: { customerId: string; productGroup: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <small className="rb-ok">{msg.message}</small>;
  return (
    <span className="rb-propose">
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => start(async () => setMsg(await proposeRebateAction(customerId, productGroup)))}>
        {pending ? "Šaljem…" : "Predloži pravilo"}
      </button>
      {msg && !msg.ok ? <small className="kk-problem">{msg.message}</small> : null}
    </span>
  );
}
