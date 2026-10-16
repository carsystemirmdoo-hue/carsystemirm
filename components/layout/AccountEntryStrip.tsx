"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { customerSignOutAction } from "@/app/prijava/kupac/actions";
import { ensureCustomerSession, hasCustomerMarker } from "@/components/customer-buy/customerSession";
import styles from "./AccountEntryStrip.module.css";

/**
 * Traka sa ulazima za kupce i zaposlene, iznad zaglavlja i na strani „sajt u pripremi“.
 *
 * Neprijavljen: „Prijava kupca“ i „Za zaposlene“. Prijavljen kupac: „Moj nalog“ i „Odjavite se“.
 * Kupčeva prijava se PROVERAVA istim pozivom kao zaglavlje (`/api/kupac/sesija`): zaostala oznaka
 * `cs_kupac` posle isteka sesije ne sme da sakrije „Prijava kupca“. Bez oznake se ne pravi nijedan
 * zahtev — javne strane ostaju statične. „Za zaposlene“ se uvek vidi; sa oznakom zaposlenog vodi
 * pravo u portal (koji i dalje sam proverava sesiju).
 */
export function AccountEntryStrip({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname() ?? "/";
  const [customer, setCustomer] = useState(false);
  const [staff, setStaff] = useState(false);
  useEffect(() => {
    let alive = true;
    setStaff(/(?:^|;\s*)cs_zaposleni=1/.test(document.cookie));
    if (!hasCustomerMarker()) {
      setCustomer(false);
      return;
    }
    ensureCustomerSession().then((s) => {
      if (!alive) return;
      const signedIn = Boolean(s && s.signedIn);
      setCustomer(signedIn);
      // Zaostala oznaka (sesija istekla, nema zapamćenog uređaja): briše se, da sledeća strana ne pita.
      if (s && !s.signedIn) document.cookie = "cs_kupac=; Max-Age=0; path=/; SameSite=Lax";
    });
    return () => {
      alive = false;
    };
  }, [pathname]);
  // Povratak posle prijave kupca samo na javnu stranu (ne na prijavu ili „sajt u pripremi“).
  const back = /^\/(?!prijava|site-u-pripremi|kupac)/.test(pathname) && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
  const returnTo = typeof window === "undefined" ? pathname : `${window.location.pathname}${window.location.search}`;
  return (
    <nav className={styles.strip} data-tone={tone} aria-label="Prijava">
      <div className={styles.inner}>
        {customer ? (
          <>
            <Link href="/kupac" className={styles.link} data-primary="true">Moj nalog</Link>
            {/* U kupčevom panelu odjava već postoji u njegovom zaglavlju — bez dvostrukog dugmeta. */}
            {pathname.startsWith("/kupac") ? null : (
              <form action={customerSignOutAction} className={styles.form}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <button type="submit" className={styles.link}>Odjavite se</button>
              </form>
            )}
          </>
        ) : (
          <Link href={`/prijava/kupac${back}`} className={styles.link} data-primary="true">Prijava kupca</Link>
        )}
        <span className={styles.sep} aria-hidden="true" />
        <Link href={staff ? "/portal" : "/prijava"} className={styles.link}>Za zaposlene</Link>
      </div>
    </nav>
  );
}
