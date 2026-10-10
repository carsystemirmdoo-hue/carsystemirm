"use client";

import { useState, useTransition } from "react";
import { decideBatchAction } from "./batch-actions";

export function BatchDecision({ batchId, count }: { batchId: string; count: number }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <small className="rb-ok">{msg.message}</small>;
  const run = (to: "approved_pending_biznisoft" | "rejected") => start(async () => setMsg(await decideBatchAction(batchId, to, reason || null)));
  return (
    <span className="rb-propose">
      <button type="button" className="portal-button" disabled={pending} onClick={() => run("approved_pending_biznisoft")}>
        {pending ? "Upisujem…" : `Odobrite paket (${count})`}
      </button>
      <input aria-label="Razlog odbijanja" placeholder="razlog (za odbijanje)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !reason.trim()} onClick={() => run("rejected")}>
        Odbijte paket
      </button>
      {msg && !msg.ok ? <small className="kk-problem">{msg.message}</small> : null}
    </span>
  );
}
