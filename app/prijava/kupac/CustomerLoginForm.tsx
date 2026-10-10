"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CustomerAuthShell } from "@/components/customer/CustomerAuthShell";
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
  // Kontrolisano polje: posle neuspele prijave React prazni obrazac, a e-pošta treba da ostane.
  const [email, setEmail] = useState("");

  return (
    <CustomerAuthShell
      title="Prijava kupca"
      lead="Prijavite se nalogom koji je otvoren za Vašu firmu. Nalog vidi isključivo podatke Vaše firme."
      aside={
        <>
          <p>Nalog otvara kancelarija — pristup se ne otvara samostalnom registracijom. Za otvaranje naloga obratite se svom komercijalisti.</p>
          <p>Ovo je pristup za kupce. Zaposleni se prijavljuju na zasebnoj adresi.</p>
        </>
      }
    >
      <form action={formAction} noValidate={false}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        {notice ? (
          <p className="pn-note" data-tone="info" role="status">
            <span>{notice}</span>
          </p>
        ) : null}

        <div className="pn-field">
          <label htmlFor="prijava-email">E-pošta</label>
          <input
            id="prijava-email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            maxLength={254}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "prijava-greska" : undefined}
          />
        </div>

        <div className="pn-field">
          <label htmlFor="prijava-lozinka">Lozinka</label>
          <input
            id="prijava-lozinka"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={200}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "prijava-greska" : undefined}
          />
          <Link href="/prijava/kupac/lozinka" className="pn-small" style={{ justifySelf: "start" }}>
            Zaboravili ste lozinku?
          </Link>
        </div>

        {/*
          „Zapamti me" samo kada je uključeno (CUSTOMER_REMEMBER_ME=1) i nikad
          unapred čekirano: kupac svesno bira da uređaj ostane prijavljen.
        */}
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
          <p id="prijava-greska" className="pn-note" data-tone="danger" role="alert">
            <span>
              <strong>Prijava nije uspela.</strong> {state.error}
            </span>
          </p>
        ) : null}

        <button className="pn-btn" data-variant="primary" type="submit" disabled={pending} aria-busy={pending || undefined} style={{ width: "100%" }}>
          {pending ? "Provera pristupa…" : "Prijavite se"}
        </button>
      </form>
    </CustomerAuthShell>
  );
}
