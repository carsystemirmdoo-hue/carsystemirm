"use client";

import { useState, useTransition } from "react";
import { createTrialAccountAction } from "./actions";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";

type Trial = { customerId: string; name: string; accounts: { email: string; status: string }[] };

/**
 * Kontrolisana proba (samo vlasnik): izdvojeni test kupac i probni nalozi.
 * Link za aktivaciju se prikazuje JEDNOM — vlasnik ga otvara i sam postavlja lozinku.
 */
export function TrialPanel({ trials }: { trials: Trial[] }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("Proba — vlasnik");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  if (!trials.length) return <p className="pn-small pn-muted">Nijedan test kupac nije uključen za probu.</p>;
  const t = trials[0];
  return (
    <div className="pn" style={{ gap: 12, marginTop: 8 }}>
      <p className="pn-small">
        Test kupac: <strong>{t.name}</strong> — nema faktura i nije stvarna firma. Zahtev za porudžbinu je uključen samo za njega; za sve stvarne kupce je isključen.
      </p>
      {t.accounts.length ? (
        <ul className="pn-versions" aria-label="Probni nalozi">
          {t.accounts.map((a) => (
            <li key={a.email}>
              <span style={{ overflowWrap: "anywhere" }}>{a.email}</span>
              <span className="pn-small pn-muted">{a.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="pn-filters">
        <div className="pn-field">
          <label htmlFor="proba-email">E-pošta probnog naloga</label>
          <input id="proba-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
        <div className="pn-field">
          <label htmlFor="proba-ime">Ime</label>
          <input id="proba-ime" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="button" className="pn-btn" disabled={pending || !email.includes("@")} aria-busy={pending || undefined}
          onClick={() => start(async () => {
            const r = await createTrialAccountAction(t.customerId, email, name);
            setMsg(r.ok ? { ok: true, text: `Link važi do ${dmyTime(new Date(r.expiresAt ?? ""))}. Otvorite ga i sami postavite lozinku; prikazuje se samo sada.`, link: r.link } : { ok: false, text: r.message ?? "Nije uspelo." });
          })}>
          {pending ? "Pravi se…" : "Napravite probni nalog"}
        </button>
      </div>
      {!email.includes("@") ? <p className="pn-why">Dugme se uključuje kada upišete e-poštu.</p> : null}
      {msg ? (
        <div className="pn-note" data-tone={msg.ok ? "success" : "danger"} role="status">
          <span>
            {msg.text}
            {msg.link ? <><br /><a href={msg.link} target="_blank" rel="noreferrer">{`${typeof window !== "undefined" ? window.location.origin : ""}${msg.link}`}</a></> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
