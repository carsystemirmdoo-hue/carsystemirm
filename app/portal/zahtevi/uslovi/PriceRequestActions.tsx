"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerPriceRequestAction, closePriceRequestAction, takePriceRequestAction } from "./actions";

export function PriceRequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.message ?? "Nije uspelo."));
      if (r.ok) router.refresh();
    });
  return (
    <div className="kk-step">
      {status === "open" ? (
        <span className="kk-step-actions">
          <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => run(() => takePriceRequestAction(id))}>
            Preuzmite
          </button>
        </span>
      ) : null}
      {status === "open" || status === "in_progress" ? (
        <label className="kk-reason">
          <span>Odgovor kupcu (vidi ga u „Upiti”)</span>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} maxLength={2000} disabled={pending} />
          <span className="kk-step-actions">
            <button type="button" className="portal-button" data-variant="primary" disabled={pending} onClick={() => run(() => answerPriceRequestAction(id, answer))}>
              Pošaljite odgovor
            </button>
          </span>
        </label>
      ) : null}
      <span className="kk-step-actions">
        <button type="button" className="portal-button" data-variant="ghost" disabled={pending} onClick={() => run(() => closePriceRequestAction(id))}>
          Zatvorite
        </button>
      </span>
      {error ? <p className="kk-problem" role="alert">{error}</p> : null}
    </div>
  );
}
