import type { Metadata } from "next";
import Link from "next/link";
import { CustomerAuthShell } from "@/components/customer/CustomerAuthShell";
import "../../../portal/portal.css";
import "../../../portal/panel.css";

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
    <CustomerAuthShell title="Zaboravljena lozinka" lead="Za novu lozinku obratite se svom komercijalisti ili kancelariji. Dobićete nov link za pristup, preko kog sami postavljate lozinku.">
      <Link href="/prijava/kupac" className="pn-btn" style={{ justifySelf: "start" }}>
        ← Nazad na prijavu
      </Link>
    </CustomerAuthShell>
  );
}
