"use client";

import { useActionState } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import {
  customerSignInAction,
  type CustomerLoginState,
} from "@/app/prijava/kupac/actions";

const INITIAL: CustomerLoginState = { error: null };

/**
 * Prijava kupca.
 *
 * Namerno bez polja za drugi faktor: kupčev nalog u ovoj fazi nema MFA, i
 * prazno polje koje ništa ne radi bi lagalo o zaštiti koju nalog nema.
 */
export function CustomerLoginForm({ callbackUrl, rememberAvailable = false, notice = null }: { callbackUrl: string; rememberAvailable?: boolean; notice?: string | null }) {
  const [state, formAction, pending] = useActionState(
    customerSignInAction,
    INITIAL,
  );

  return (
    <main className="portal-login-root">
      <section
        className="portal-login-brand"
        aria-label="Carsystem i R-M — pristup za kupce"
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
          <span>PRISTUP ZA KUPCE</span>
          <h1>Vaš nalog, vaši podaci.</h1>
          <p>
            Nalog vidi isključivo podatke vaše firme. Nalog otvara kancelarija —
            pristup se ne otvara samostalnom registracijom.
          </p>
        </div>
        <footer>
          <span>
            <i />
            Odobreni nalozi
          </span>
          <small>Za otvaranje naloga obratite se svom komercijalisti</small>
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
            <span>Pristup za kupce</span>
            <h2>Prijava kupca</h2>
            <p>Prijavite se nalogom koji je otvoren za vašu firmu.</p>
          </header>

          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          {notice ? (
            <p className="portal-login-hint" role="status">
              {notice}
            </p>
          ) : null}

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

          {/*
            „Zapamti me" samo kada je uključeno (CUSTOMER_REMEMBER_ME=1) i nikad
            unapred čekirano: kupac svesno bira da uređaj ostane prijavljen.
          */}
          {rememberAvailable ? (
            <label className="portal-login-remember">
              <input type="checkbox" name="remember" value="on" />
              <span>
                <strong>Zapamti me na ovom uređaju 30 dana</strong>
                <small>Ne uključujte na zajedničkom računaru. Slanje porudžbine i dalje traži lozinku.</small>
              </span>
            </label>
          ) : null}

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
            <span>
              Ovo je pristup za kupce. Zaposleni se prijavljuju na zasebnoj
              adresi.
            </span>
          </p>
        </form>
      </section>
    </main>
  );
}
