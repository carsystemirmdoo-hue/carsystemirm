"use client";

/* eslint-disable @next/next/no-img-element -- Odobren statički SVG znak firme. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/**
 * Zaglavlje prijave i kupčevog naloga dok je javni sajt u pripremi: bez javnog
 * menija i pretrage, jer bi oni vodili na „sajt u pripremi“.
 */
export function AccountOnlyHeader() {
  // Zajednički ekran prijave (kupci i zaposleni) nije „nalog kupca“.
  const login = (usePathname() ?? "").startsWith("/prijava");
  return (
    <header className="acct-bar">
      <Link href={login ? "/" : "/kupac"} className="acct-bar-brand" aria-label={login ? "Carsystem i R-M" : "Nalog kupca"}>
        <img src="/brands/carsystem.svg" alt="" width="36" height="36" decoding="async" />
        <span>Carsystem i R-M <small>{login ? "Prijava" : "Nalog kupca"}</small></span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
