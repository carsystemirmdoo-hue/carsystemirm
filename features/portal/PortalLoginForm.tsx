"use client";

import { useActionState } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { signInAction, type LoginState } from "@/app/portal/actions";
import { CALLBACK_PARAM } from "@/lib/authz/redirects.mjs";

const INITIAL: LoginState = { error: null };

export function PortalLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);

  return (
    <main className="portal-login-root">
      <section
        className="portal-login-brand"
        aria-label="Carsystem i R-M poslovni sistem"
      >
        <div className="portal-login-brand-top">
          <span className="portal-company-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Carsystem i R-M DOO</strong>
            <small>Inđija · Srbija</small>
          </span>
        </div>
        <div className="portal-login-brand-copy">
          <span>CS / RM · INTERNO</span>
          <h1>Poslovni tok, bez zastoja.</h1>
          <p>
            Kupci, prodaja, zalihe, otprema i nabavka na jednom mestu — sa
            pristupom koji odgovara ulozi.
          </p>
        </div>
        <footer>
          <span>
            <i />
            Ovlašćeni pristup
          </span>
          <small>Naloge otvara Gazda kroz Korisnike i dozvole</small>
        </footer>
      </section>

      <section className="portal-login-form-side">
        <form className="portal-login-form" action={formAction}>
          <div className="portal-login-mobile-mark">
            <span className="portal-company-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>Carsystem i R-M DOO</strong>
          </div>

          <header>
            <span>Ovlašćeni pristup</span>
            <h2>Poslovni sistem</h2>
            <p>Prijavite se službenim nalogom.</p>
          </header>

          <input type="hidden" name={CALLBACK_PARAM} value={callbackUrl} />

          <label className="portal-login-field">
            <span>E-pošta</span>
            <div>
              <PortalIcon name="mail" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
                aria-invalid={Boolean(state.error)}
              />
            </div>
          </label>

          <label className="portal-login-field">
            <span>Lozinka</span>
            <div>
              <PortalIcon name="lock" />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={200}
                aria-invalid={Boolean(state.error)}
              />
            </div>
          </label>

          {state.error ? (
            <div className="portal-login-error" role="alert">
              <PortalIcon name="warning" />
              <span>
                <strong>Prijava nije uspela</strong>
                <small>{state.error}</small>
              </span>
            </div>
          ) : null}

          <button
            className="portal-login-submit"
            type="submit"
            disabled={pending}
          >
            {pending ? (
              <span className="portal-button-spinner" />
            ) : (
              <PortalIcon name="arrow" />
            )}
            {pending ? "Provera pristupa…" : "Prijavi se"}
          </button>

          <p className="portal-login-note">
            <PortalIcon name="lock" />
            Zaboravljenu lozinku za sada resetuje Gazda. Posle više uzastopnih
            pogrešnih pokušaja nalog se privremeno zaključava.
          </p>
        </form>
      </section>
    </main>
  );
}
