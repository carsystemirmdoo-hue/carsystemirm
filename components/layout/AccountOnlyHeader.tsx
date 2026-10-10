/* eslint-disable @next/next/no-img-element -- Odobren statički SVG znak firme. */
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * Zaglavlje prijave i kupčevog naloga dok je javni sajt u pripremi: bez javnog
 * menija i pretrage, jer bi oni vodili na „sajt u pripremi“.
 */
export function AccountOnlyHeader() {
  return (
    <header className="acct-bar">
      <Link href="/kupac" className="acct-bar-brand" aria-label="Nalog kupca">
        <img src="/brands/carsystem.svg" alt="" width="36" height="36" decoding="async" />
        <span>Carsystem i R-M <small>Nalog kupca</small></span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
