"use client";

import Link from "next/link";
import { useActionState, useState, useId } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { signInAction, type LoginState } from "@/app/portal/actions";
import { CALLBACK_PARAM } from "@/lib/authz/redirects.mjs";

const INITIAL: LoginState = { error: null };

/** Ponovna potvrda identiteta prijavljenog korisnika (osetljiva radnja, istekla potvrda). */
type Reauth = { email: string; hasSecondFactor: boolean };

export function PortalLoginForm({ callbackUrl, reauth }: { callbackUrl: string; reauth?: Reauth }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);
  // Kontrolisano polje: posle neuspele prijave React prazni obrazac, a e-pošta treba da ostane.
  const [email, setEmail] = useState(reauth?.email ?? "");
  const secondFactorHintId = useId();

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
            <strong>Carsystem i R-M</strong>
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
          <small>Naloge otvara Vlasnik kroz Korisnike i dozvole</small>
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
            <strong>Carsystem i R-M</strong>
          </div>

          {reauth ? (
            <header>
              <span>Osetljiva radnja</span>
              <h2>Potvrdite identitet</h2>
              <p>
                Ova radnja traži lozinku i kod iz autentikator aplikacije unete u poslednjih 10 minuta. Posle potvrde vraćate se na isti ekran; ništa
                nije izmenjeno.
              </p>
            </header>
          ) : (
            <header>
              <span>Ovlašćeni pristup</span>
              <h2>Poslovni sistem</h2>
              <p>Prijavite se službenim nalogom.</p>
            </header>
          )}

          {reauth && !reauth.hasSecondFactor ? (
            <div className="portal-login-error" role="alert">
              <PortalIcon name="warning" />
              <span>
                <strong>Nalog nema vezan drugi faktor</strong>
                <small>
                  Ova radnja je moguća tek kada vežete autentikator aplikaciju. <Link href="/portal/bezbednost/mfa">Vežite drugi faktor</Link>
                </small>
              </span>
            </div>
          ) : null}

          <input type="hidden" name={CALLBACK_PARAM} value={callbackUrl} />

          <label className="portal-login-field">
            <span>E-pošta</span>
            <div>
              <PortalIcon name="mail" />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={Boolean(reauth)}
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
            * Jedno polje za oba oblika drugog faktora.
            *
            * Namerno je uvek vidljivo i uvek opciono: kada bi se prikazivalo
            * tek pošto server potvrdi lozinku, sam prikaz bi odao da nalog
            * postoji i da ima MFA. Pomoćni tekst je neutralan iz istog razloga.
            */}
          <label className="portal-login-field">
            <span>Kod iz autentikator aplikacije ili rezervni kod</span>
            <div>
              <PortalIcon name="lock" />
              <input
                type="text"
                name="secondFactor"
                // `one-time-code` daje predlog iz SMS/authenticator-a na mobilnom;
                // `off` bi značio da menadžer lozinki pokuša da ga zapamti.
                autoComplete="one-time-code"
                inputMode="text"
                maxLength={64}
                aria-describedby={secondFactorHintId}
                aria-invalid={Boolean(state.error)}
              />
            </div>
            <small id={secondFactorHintId} className="portal-login-hint">
              {reauth
                ? "Kod iz aplikacije (ili jedan rezervni kod) — obavezan za ovu radnju."
                : "Popunite samo ako je za Vaš nalog uključena dvofaktorska prijava."}
            </small>
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
            {pending ? "Provera pristupa…" : reauth ? "Potvrdite i nastavite" : "Prijavite se"}
          </button>

          {reauth && callbackUrl ? (
            <p className="portal-login-note">
              <PortalIcon name="arrow" />
              <span>
                <Link href={callbackUrl}>Odustanite i vratite se</Link> — ništa nije izmenjeno.
              </span>
            </p>
          ) : null}

          {/* Ikona i tekst su zasebne stavke u flex redu; bez omotača bi svaki
              odlomak teksta oko linka postao svoja kolona i poruka bi se
              rasula u tri stupca. */}
          <p className="portal-login-note">
            <PortalIcon name="lock" />
            <span>
              Zaboravljenu lozinku menjate kodom koji izdaje Vlasnik —{" "}
              <Link href="/prijava/reset">unesite kod ovde</Link>. Posle više
              uzastopnih pogrešnih pokušaja nalog se privremeno zaključava.
            </span>
          </p>
        </form>
      </section>
    </main>
  );
}
