"use client";

import { useState, useTransition } from "react";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { addRequestItemAction } from "./actions";

export function AddItem({ articleId, step, unit }: { articleId: string; step: number; unit: string }) {
  const [q, setQ] = useState(String(step));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="kn-add">
      <label>
        <span className="sr-only">Količina ({unit})</span>
        <input inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Količina (${unit})`} />
      </label>
      <small>{unit}</small>
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending}
        onClick={() => start(async () => { const r = await addRequestItemAction({ articleId, quantity: q.replace(",", ".") }); setMsg(r.ok ? { ok: true, text: `Dodato${r.lineQuantity !== undefined ? ` · u korpi ${String(r.lineQuantity).replace(".", ",")} ${unit}` : ""} · ukupno ${countOf(r.count, STAVKA)}` } : { ok: false, text: r.message }); })}>
        {pending ? "…" : "Dodajte u zahtev"}
      </button>
      {msg ? <small className={msg.ok ? "rb-ok" : "kk-problem"} role="status">{msg.text}</small> : null}
    </span>
  );
}
