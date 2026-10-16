"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { customerSignInAction, type CustomerLoginState } from "@/app/prijava/kupac/actions";
import { signInAction, type LoginState } from "@/app/portal/actions";
import { CALLBACK_PARAM } from "@/lib/authz/redirects.mjs";
import styles from "./LoginStart.module.css";

export type LoginAudience = "kupac" | "zaposleni";

/**
 * Zajednički početni ekran prijave (kupci i zaposleni).
 *
 * Dva odvojena puta ostaju odvojena: kupac → provajder `customer`, zaposleni → `credentials`
 * (lozinka + drugi faktor u JEDNOJ serverskoj proveri, kao i ranije). Zaposleni unose lozinku i
 * kod na dva ekrana samo u pregledaču: drugi ekran se prikazuje uvek, pa ni on ne odaje da li
 * nalog postoji ili ima drugi faktor. Lozinka ostaje u istom obrascu (skrivena), pa menadžer
 * lozinki vidi običan par „korisničko ime + lozinka“ i nudi čuvanje posle uspešne prijave.
 */
export function LoginStart({
  initial,
  callbackUrl,
  rememberAvailable,
  notice,
}: {
  initial: LoginAudience;
  callbackUrl: string;
  rememberAvailable: boolean;
  notice: string | null;
}) {
  const [audience, setAudience] = useState<LoginAudience>(initial);
  const choose = (a: LoginAudience) => {
    setAudience(a);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("za", a);
      window.history.replaceState(null, "", url);
    } catch {}
  };
  return (
    <main className={`portal-root portal-customer-area pn-auth ${styles.root}`}>
      <div className={`pn pn-auth-card ${styles.card}`}>
        <header className={styles.head}>
          <span className={styles.eyebrow}>Carsystem i R-M</span>
          <h1 className="pn-title">Prijava</h1>
        </header>
        <div className={styles.tabs} role="tablist" aria-label="Vrsta naloga">
          {(
            [
              ["kupac", "Kupac"],
              ["zaposleni", "Zaposleni"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`prijava-tab-${key}`}
              aria-selected={audience === key}
              aria-controls={`prijava-panel-${key}`}
              className={styles.tab}
              onClick={() => choose(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {notice ? (
          <p className="pn-note" data-tone="info" role="status">
            <span>{notice}</span>
          </p>
        ) : null}
        <div role="tabpanel" id={`prijava-panel-${audience}`} aria-labelledby={`prijava-tab-${audience}`}>
          {audience === "kupac" ? (
            <CustomerForm callbackUrl={callbackUrl} rememberAvailable={rememberAvailable} />
          ) : (
            <StaffForm callbackUrl={callbackUrl} />
          )}
        </div>
      </div>
      <div className={`pn pn-auth-aside ${styles.aside}`}>
        {audience === "kupac" ? (
          <p>Nalog za kupce otvara kancelarija za Vašu firmu; nalog vidi samo podatke Vaše firme.</p>
        ) : (
          <p>Naloge zaposlenih otvara vlasnik. Radna sesija traje do 8 sati, najduže do ponoći.</p>
        )}
      </div>
    </main>
  );
}

const CUSTOMER_INITIAL: CustomerLoginState = { error: null };

function CustomerForm({ callbackUrl, rememberAvailable }: { callbackUrl: string; rememberAvailable: boolean }) {
  const [state, action, pending] = useActionState(customerSignInAction, CUSTOMER_INITIAL);
  const [email, setEmail] = useState("");
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="pn-field">
        <label htmlFor="prijava-kupac-email">E-pošta</label>
        <input id="prijava-kupac-email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required maxLength={254} aria-invalid={state.error ? true : undefined} />
      </div>
      <div className="pn-field">
        <label htmlFor="prijava-kupac-lozinka">Lozinka</label>
        <input id="prijava-kupac-lozinka" type="password" name="password" autoComplete="current-password" required maxLength={200} aria-invalid={state.error ? true : undefined} />
        <Link href="/prijava/kupac/lozinka" className="pn-small" style={{ justifySelf: "start" }}>
          Zaboravili ste lozinku?
        </Link>
      </div>
      {rememberAvailable ? (
        <label className="pn-check">
          <input type="checkbox" name="remember" value="on" />
          <span>
            <strong>Zapamti me na ovom uređaju 30 dana</strong>
            <small>Ne uključujte na zajedničkom računaru. Slanje zahteva i dalje traži lozinku.</small>
          </span>
        </label>
      ) : null}
      {state.error ? (
        <p className="pn-note" data-tone="danger" role="alert">
          <span>{state.error}</span>
        </p>
      ) : null}
      <button className="pn-btn" data-variant="primary" type="submit" disabled={pending} aria-busy={pending || undefined}>
        {pending ? "Provera pristupa…" : "Prijavite se"}
      </button>
    </form>
  );
}

const STAFF_INITIAL: LoginState = { error: null };

function StaffForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(signInAction, STAFF_INITIAL);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  // Neuspeh (generičan): nazad na prvi korak, lozinka i kod se unose ponovo.
  useEffect(() => {
    if (!state.error) return;
    setStep(1);
    setPassword("");
    setCode("");
    passwordRef.current?.focus();
  }, [state]);
  useEffect(() => {
    if (step === 2) codeRef.current?.focus();
  }, [step]);
  return (
    <form
      action={action}
      className={styles.form}
      onSubmit={(e) => {
        if (step === 1) {
          e.preventDefault();
          if (emailRef.current?.reportValidity() && passwordRef.current?.reportValidity()) setStep(2);
        }
      }}
    >
      <input type="hidden" name={CALLBACK_PARAM} value={callbackUrl} />
      <div hidden={step !== 1} className={styles.step}>
        <div className="pn-field">
          <label htmlFor="prijava-zap-email">E-pošta</label>
          <input ref={emailRef} id="prijava-zap-email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required maxLength={254} aria-invalid={state.error ? true : undefined} />
        </div>
        <div className="pn-field">
          <label htmlFor="prijava-zap-lozinka">Lozinka</label>
          <input ref={passwordRef} id="prijava-zap-lozinka" type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required maxLength={200} aria-invalid={state.error ? true : undefined} />
          <Link href="/prijava/reset" className="pn-small" style={{ justifySelf: "start" }}>
            Imate kod za novu lozinku?
          </Link>
        </div>
        {state.error ? (
          <p className="pn-note" data-tone="danger" role="alert">
            <span>{state.error}</span>
          </p>
        ) : null}
        <button className="pn-btn" data-variant="primary" type="submit">
          Nastavite
        </button>
      </div>
      <div hidden={step !== 2} className={styles.step}>
        <p className={styles.who}>
          <span>{email}</span>
          <button type="button" className={styles.back} onClick={() => setStep(1)}>
            Promenite
          </button>
        </p>
        <div className="pn-field">
          <label htmlFor="prijava-zap-kod">Kod iz Google Authenticator-a</label>
          <input
            ref={codeRef}
            id="prijava-zap-kod"
            type="text"
            name="secondFactor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            inputMode="text"
            maxLength={64}
            aria-describedby={hintId}
            className={styles.code}
          />
          <small id={hintId} className="pn-muted pn-small">
            Šestocifreni kod iz aplikacije ili jedan rezervni kod.
          </small>
        </div>
        <button className="pn-btn" data-variant="primary" type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Provera pristupa…" : "Prijavite se"}
        </button>
      </div>
    </form>
  );
}
