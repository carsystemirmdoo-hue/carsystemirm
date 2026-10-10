"use client";

import { useState, useTransition } from "react";
import { createTrialAccountAction } from "./actions";

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
  if (!trials.length) return <p className="portal-data-note">Nijedan test kupac nije uključen za probu.</p>;
  const t = trials[0];
  return (
    <div className="rc-change">
      <p>
        Test kupac: <strong>{t.name}</strong> — nema faktura i nije stvarna firma. Zahtev za porudžbinu je uključen samo za njega; za sve stvarne kupce je isključen.
      </p>
      {t.accounts.length ? (
        <ul className="rc-articles">
          {t.accounts.map((a) => (
            <li key={a.email}>{a.email} · {a.status}</li>
          ))}
        </ul>
      ) : null}
      <div className="rc-inline">
        <label className="rr-field"><span>E-pošta probnog naloga</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Vaša adresa" /></label>
        <label className="rr-field"><span>Ime</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !email.includes("@")}
          onClick={() => start(async () => {
            const r = await createTrialAccountAction(t.customerId, email, name);
            setMsg(r.ok ? { ok: true, text: `Link važi do ${new Date(r.expiresAt ?? "").toLocaleString("sr-RS")}. Otvorite ga i sami postavite lozinku; prikazuje se samo sada.`, link: r.link } : { ok: false, text: r.message ?? "Nije uspelo." });
          })}>
          {pending ? "Pravim…" : "Napravite probni nalog"}
        </button>
      </div>
      {msg ? (
        <div className={msg.ok ? "portal-permission-ok" : "portal-login-error"} role="status">
          {msg.text}
          {msg.link ? <p><a href={msg.link} target="_blank" rel="noreferrer">{`${typeof window !== "undefined" ? window.location.origin : ""}${msg.link}`}</a></p> : null}
        </div>
      ) : null}
    </div>
  );
}
