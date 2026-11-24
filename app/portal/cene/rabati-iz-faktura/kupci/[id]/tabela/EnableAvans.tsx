"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enableAvansAction } from "./actions";

/** Avans nije odobren kupcu: odobrite ga ovde (uz odloženo plaćanje ako ga kupac još nema). */
export function EnableAvans({ customerId, needsDeferred }: { customerId: string; needsDeferred: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState("30");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="portal-readiness-note rr-enable-avans" role="region" aria-label="Odobrite avans">
      <p>
        <b>Kupcu avans još nije odobren.</b> Odobrite ga ovde, pa upišite avansne rabate.
        {needsDeferred ? " Kupac nema ni odobreno odloženo plaćanje — izaberite rok, da bi na portalu mogao da bira odloženo ili avans." : ""}
      </p>
      <div className="portal-inline-form">
        {needsDeferred ? (
          <label>
            Odloženo plaćanje
            <select value={days} onChange={(e) => setDays(e.target.value)} disabled={pending}>
              {["15", "30", "45", "60", "90"].map((d) => (
                <option key={d} value={d}>{d} dana</option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="portal-button"
          data-variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await enableAvansAction({ customerId, deferredDays: needsDeferred ? Number(days) : null });
              setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? "Odobravam…" : needsDeferred ? `Odobrite avans i odloženo ${days} dana` : "Odobrite avans"}
        </button>
        {msg ? <span role={msg.ok ? "status" : "alert"} className={msg.ok ? undefined : "portal-error"}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
