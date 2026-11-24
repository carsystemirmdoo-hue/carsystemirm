"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { prepareAllAccountsAction } from "./prepare-actions";

/** Jedno dugme: nalozi za sve kupce sa e-poštom, u stanju „čeka potvrdu i poziv“. Bez mejla. */
export function PrepareAll({ withoutAccount, withEmail }: { withoutAccount: number; withEmail: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [r, setR] = useState<{ ok: boolean; message: string; skipped: { customer: string; reason: string }[] } | null>(null);
  return (
    <section className="portal-panel" aria-label="Priprema naloga za sve kupce">
      <div className="portal-section-header">
        <div>
          <h2>Priprema naloga za sve kupce</h2>
          <p>
            Bez naloga: {withoutAccount} kupaca, od toga {withEmail} ima e-poštu. Dugme pravi nalog svakom od njih (bez lozinke i bez prava prijave). <b>Nijedan mejl se ne šalje</b> —
            pozivnice šaljete Vi, u talasima, posle potvrde ovlašćene osobe.
          </p>
        </div>
      </div>
      <div className="portal-inline-form pa-row">
        <button
          type="button"
          className="portal-button"
          data-variant="primary"
          disabled={pending || withEmail === 0}
          onClick={() => {
            if (!window.confirm(`Pripremiti ${withEmail} naloga? Mejlovi se NE šalju.`)) return;
            start(async () => {
              setR(await prepareAllAccountsAction());
              router.refresh();
            });
          }}
        >
          {pending ? "Pripremam…" : `Pripremite naloge (${withEmail})`}
        </button>
        {r ? <span role="status" className={r.ok ? "portal-permission-ok" : "portal-login-error"}>{r.message}</span> : null}
      </div>
      {r?.skipped.length ? (
        <details className="pa-skipped">
          <summary>Preskočeni kupci ({r.skipped.length})</summary>
          <ul>{r.skipped.map((s, i) => <li key={i}><b>{s.customer}</b> — {s.reason}</li>)}</ul>
        </details>
      ) : null}
    </section>
  );
}
