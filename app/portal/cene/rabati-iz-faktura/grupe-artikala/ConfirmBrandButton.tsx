"use client";

import { useState, useTransition } from "react";
import { confirmBrandAction } from "./actions";

export function ConfirmBrandButton({ brand, count }: { brand: string; count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <small className="rb-ok">{msg.message}</small>;
  return (
    <span className="rb-propose">
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending}
        onClick={() => start(async () => setMsg(await confirmBrandAction(brand, `Pregledano: svi artikli sa prefiksom „${brand}“ pripadaju grupi ${brand}.`)))}>
        {pending ? "Upisujem…" : `Potvrdite grupu (${count})`}
      </button>
      {msg && !msg.ok ? <small className="kk-problem">{msg.message}</small> : null}
    </span>
  );
}
