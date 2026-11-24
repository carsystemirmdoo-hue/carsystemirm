"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transferCustomersAction } from "@/app/portal/kupci/bez-dodele/actions";

type Rep = { id: string; name: string; active: boolean; n: number };

/** Predaja svih kupaca jednog komercijaliste drugom (kada neko ode iz firme). */
export function RepTransfer({ reps }: { reps: Rep[] }) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const src = reps.find((r) => r.id === from);
  return (
    <section className="portal-panel" aria-label="Predaja kupaca">
      <div className="portal-section-header">
        <div>
          <h2>Predaja kupaca komercijaliste</h2>
          <p>Kada komercijalista ode iz firme, svi njegovi kupci prelaze na drugog jednim potezom. Važi odmah; istorija faktura se ne menja. Nalog zaposlenog isključujete na „Nalozi zaposlenih“.</p>
        </div>
      </div>
      <div className="portal-inline-form rt-form">
        <label>
          Od
          <select value={from} onChange={(e) => setFrom(e.target.value)} disabled={pending}>
            <option value="">Izaberite…</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.active ? "" : " (neaktivan)"} — {r.n} kupaca</option>
            ))}
          </select>
        </label>
        <label>
          Na
          <select value={to} onChange={(e) => setTo(e.target.value)} disabled={pending}>
            <option value="">Izaberite…</option>
            {reps.filter((r) => r.active && r.id !== from).map((r) => (
              <option key={r.id} value={r.id}>{r.name} — {r.n} kupaca</option>
            ))}
          </select>
        </label>
        <label className="rt-reason">
          Razlog
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. otišao iz firme 30.11." maxLength={300} disabled={pending} />
        </label>
        <button
          type="button"
          className="portal-button"
          data-variant="primary"
          disabled={pending || !from || !to || reason.trim().length < 3}
          onClick={() => {
            if (!window.confirm(`Predati svih ${src?.n ?? 0} kupaca (${src?.name}) drugom komercijalisti?`)) return;
            start(async () => {
              const r = await transferCustomersAction(from, to, reason);
              setMsg({ ok: r.ok, text: r.message });
              if (r.ok) {
                setFrom("");
                setTo("");
                setReason("");
                router.refresh();
              }
            });
          }}
        >
          {pending ? "Predajem…" : "Predajte kupce"}
        </button>
      </div>
      {msg ? <p className={msg.ok ? "portal-permission-ok" : "portal-login-error"} role="status">{msg.text}</p> : null}
    </section>
  );
}
