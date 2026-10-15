"use client";

import { useActionState } from "react";
import { setStockDisplayAction, type StockDisplayState } from "@/app/portal/zalihe/actions";

const INITIAL: StockDisplayState = { error: null, ok: null };

/** Vlasnik: uključivanje/isključivanje prikaza lagera kupcima (razlog ide u audit). */
export function StockDisplayToggle({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(setStockDisplayAction, INITIAL);
  return (
    <form action={action} className="lg-toggle">
      <input type="hidden" name="prikaz" value={enabled ? "iskljuci" : "ukljuci"} />
      <label className="portal-field lg-note">
        <span>Razlog izmene</span>
        <input type="text" name="razlog" required minLength={3} maxLength={300} disabled={pending} placeholder={enabled ? "npr. provera podataka" : "npr. potvrđen današnji lager"} />
      </label>
      <div className="lg-actions">
        <button type="submit" className="portal-button" data-variant={enabled ? "secondary" : "primary"} disabled={pending}>
          {pending ? "Čuvam…" : enabled ? "Isključite prikaz kupcima" : "Uključite prikaz kupcima"}
        </button>
        <span className="lg-hint">Traži kod iz aplikacije u poslednjih 10 minuta.</span>
      </div>
      {state.error ? <p className="portal-login-error lg-status" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="portal-permission-ok lg-status" role="status">{state.ok}</p> : null}
    </form>
  );
}
