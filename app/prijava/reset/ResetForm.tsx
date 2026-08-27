"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { completeResetAction } from "./actions";
import { EMPTY_RESET } from "./types";

/**
 * Postavljanje nove lozinke kodom koji je izdao vlasnik.
 *
 * Deli izgled sa prijavom namerno. Čovek koji ovde stigne je već zbunjen —
 * ne može da uđe — pa strana koja izgleda kao drugi sajt samo pojačava sumnju
 * da je negde pogrešio. Isti okvir, isti raspored, isti oblik polja.
 *
 * Kod se unosi rukom i nikad ne dolazi iz adrese: adresa sa kodom završila bi u
 * istoriji pretraživača, u `Referer` zaglavlju sledećeg zahteva i u logu svakog
 * posrednika na putu — a kod treba da važi tačno jednom.
 */
export function ResetForm() {
  const [state, formAction, pending] = useActionState(
    completeResetAction,
    EMPTY_RESET,
  );

  const hintId = useId();

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
          <span>CS / RM · OPORAVAK PRISTUPA</span>
          <h1>Nova lozinka, u dva koraka.</h1>
          <p>
            Vlasnik vam predaje kod lično ili telefonom. Vi birate novu lozinku —
            niko drugi je ne saznaje.
          </p>
        </div>
        <footer>
          <span>
            <i />
            Kod važi 30 minuta
          </span>
          <small>Koristi se jednom i ne šalje se e-poštom</small>
        </footer>
      </section>

      <section className="portal-login-form-side">
        {state.done ? (
          <div className="portal-login-form">
            <div className="portal-login-mobile-mark">
              <span className="portal-company-symbol" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>Carsystem i R-M DOO</strong>
            </div>
            <header>
              <span>Gotovo</span>
              <h2>Lozinka je postavljena</h2>
              <p>
                Kod je iskorišćen i više ne važi. Ako je na nalogu uključen drugi
                faktor, prijava će tražiti i kod iz aplikacije.
              </p>
            </header>
            <Link className="portal-login-submit" href="/prijava">
              <PortalIcon name="arrow" />
              Idi na prijavu
            </Link>
          </div>
        ) : (
          <form className="portal-login-form" action={formAction}>
            <div className="portal-login-mobile-mark">
              <span className="portal-company-symbol" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>Carsystem i R-M DOO</strong>
            </div>

            {/* `h1` nosi bocni panel, kao i na prijavi; ovde ide `h2` da strana
                ne bi imala dva naslova prvog reda. */}
            <header>
              <span>Oporavak pristupa</span>
              <h2>Nova lozinka</h2>
              <p>Unesite kod koji vam je vlasnik predao.</p>
            </header>

            <label className="portal-login-field">
              <span>Poslovna e-pošta</span>
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
              <span>Kod za promenu lozinke</span>
              <div>
                <PortalIcon name="lock" />
                <input
                  type="text"
                  name="code"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  maxLength={64}
                  aria-invalid={Boolean(state.error)}
                />
              </div>
            </label>

            <label className="portal-login-field">
              <span>Nova lozinka</span>
              <div>
                <PortalIcon name="lock" />
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={200}
                  aria-describedby={hintId}
                />
              </div>
              <small id={hintId} className="portal-login-hint">
                Najmanje 12 znakova. Duga fraza je jača od kratke sa simbolima.
              </small>
            </label>

            <label className="portal-login-field">
              <span>Potvrda nove lozinke</span>
              <div>
                <PortalIcon name="lock" />
                <input
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={200}
                />
              </div>
            </label>

            {state.error ? (
              <div className="portal-login-error" role="alert">
                <PortalIcon name="warning" />
                <span>
                  <strong>Lozinka nije promenjena</strong>
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
              {pending ? "Postavljanje…" : "Postavi lozinku"}
            </button>

            {/* Tekst i link u jednom omotaču: u flex redu bi svaki odlomak
                oko linka postao svoja kolona. */}
            <p className="portal-login-note">
              <PortalIcon name="lock" />
              <span>
                Nemate kod? Zatražite ga od vlasnika — ne šalje se e-poštom.{" "}
                <Link href="/prijava">Nazad na prijavu</Link>
              </span>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
