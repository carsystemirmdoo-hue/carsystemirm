"use client";

import { useState, useTransition } from "react";
import { proposeArticleRebateAction } from "./actions";

export function ProposeArticleButton({ customerId, articleId, percent }: { customerId: string; articleId: string; percent: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <small className="rb-ok">{msg.message}</small>;
  return (
    <span className="rb-propose">
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => start(async () => setMsg(await proposeArticleRebateAction(customerId, articleId)))}>
        {pending ? "Šaljem…" : `Predložite ${percent} %`}
      </button>
      {msg && !msg.ok ? <small className="kk-problem">{msg.message}</small> : null}
    </span>
  );
}
