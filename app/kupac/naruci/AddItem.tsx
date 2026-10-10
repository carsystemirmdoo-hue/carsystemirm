"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { quantity as fmtQty } from "@/lib/ordering/panelFormat.mjs";
import { addRequestItemAction } from "./actions";

/** Količina + „Dodajte u korpu“. Poruka o ishodu stoji uz red (čitač ekrana je čuje). */
export function AddItem({ articleId, step, unit, name }: { articleId: string; step: number; unit: string; name: string }) {
  const [q, setQ] = useState(String(step).replace(".", ","));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <span className="pn-inline" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
        <input
          className="pn-input pn-qty"
          inputMode="decimal"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMsg(null);
          }}
          aria-label={`Količina, ${name} (${unit})`}
        />
        <span className="pn-muted pn-small" style={{ minWidth: 28 }}>{unit}</span>
        <button
          type="button"
          className="pn-btn"
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={() =>
            start(async () => {
              const r = await addRequestItemAction({ articleId, quantity: q.replace(",", ".") });
              setMsg(
                r.ok
                  ? { ok: true, text: `Dodato${r.lineQuantity !== undefined ? ` · u korpi ${fmtQty(r.lineQuantity)} ${unit}` : ""} · ukupno ${countOf(r.count, STAVKA)}` }
                  : { ok: false, text: r.message },
              );
            })
          }
        >
          {pending ? "Dodaje se…" : "Dodajte u korpu"}
        </button>
      </span>
      <span role="status" aria-live="polite" className={msg ? (msg.ok ? "pn-small" : "pn-error") : undefined} style={msg?.ok ? { color: "var(--pn-ok-ink)", fontWeight: 600 } : undefined}>
        {msg ? (
          <>
            {msg.text}
            {msg.ok ? (
              <>
                {" "}
                · <Link href="/kupac/korpa">korpa</Link>
              </>
            ) : null}
          </>
        ) : null}
      </span>
    </div>
  );
}
