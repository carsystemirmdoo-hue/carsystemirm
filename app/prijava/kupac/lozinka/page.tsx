import type { Metadata } from "next";
import Link from "next/link";
import "../../../portal/portal.css";

export const metadata: Metadata = {
  title: "Zaboravljena lozinka · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * Samostalna promena zaboravljene lozinke je isključena (odluka 2026-10-01).
 *
 * Bez slanja e-pošte link za promenu nije imao kako da stigne do kupca.
 * Oporavak ide preko kancelarije: nova pozivnica vodi na aktivaciju, gde kupac
 * sam postavlja novu lozinku. Stari linkovi sa `?token=` ovde ne rade ništa.
 */
export default function CustomerPasswordPage() {
  return (
    <main className="portal-login-root">
      <section className="portal-login-form-side">
        <div className="portal-login-form">
          <header>
            <span>Pristup za kupce</span>
            <h2>Zaboravljena lozinka</h2>
            <p>
              Za novu lozinku se obratite svom komercijalisti ili kancelariji. Dobićete nov
              link za pristup, preko kog sami postavljate lozinku.
            </p>
          </header>
          <p className="portal-login-hint">
            <Link href="/prijava/kupac">Nazad na prijavu</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
