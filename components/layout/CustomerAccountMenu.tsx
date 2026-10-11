"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { customerSignOutAction } from "@/app/prijava/kupac/actions";
import { ensureCustomerSession } from "@/components/customer-buy/customerSession";
import styles from "./CustomerAccountMenu.module.css";

type State = { signedIn: true; company: string; name: string; cartCount?: number } | { signedIn: false; loginLink: boolean } | null;

/**
 * Kupčev nalog u javnom zaglavlju.
 *
 * Stanje prijave se čita posle učitavanja (`/api/kupac/sesija`), pa javne
 * strane ostaju statične. Dok odgovor ne stigne, ne iscrtava se ništa — bolje
 * nego da zaglavlje trepne „Prijava" prijavljenom kupcu.
 */
export function CustomerAccountMenu({ variant = "desktop", onNavigate }: { variant?: "desktop" | "mobile"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [state, setState] = useState<State>(null);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    /*
     * Bez markera (postavlja ga prijava kupca) server se ne pita: anonimni
     * posetioci ne prave nijedan dodatan zahtev, a javne strane ostaju statične.
     */
    if (!/(?:^|;\s*)cs_kupac=1/.test(document.cookie)) {
      setState({ signedIn: false, loginLink: process.env.NEXT_PUBLIC_CUSTOMER_LOGIN_LINK === "1" });
      return;
    }
    const load = () =>
      fetch("/api/kupac/sesija", { cache: "no-store", credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => alive && setState(body))
        .catch(() => alive && setState(null));
    // Prvi poziv je zajednički sa ostatkom strane (obnova sa zapamćenog uređaja);
    // posle promene strane stanje se čita sveže (npr. broj stavki u korpi).
    if (firstLoad.current) {
      firstLoad.current = false;
      ensureCustomerSession().then((body) => alive && setState(body));
    } else {
      load();
    }
    window.addEventListener("focus", load);
    // Dodavanje u korpu sa kataloga ili „Poručite ponovo“ javlja novi broj stavki (ista serverska korpa).
    const onCart = (e: Event) => {
      const count = (e as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof count === "number") setState((st) => (st && st.signedIn ? { ...st, cartCount: count } : st));
    };
    window.addEventListener("cs-korpa", onCart);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("cs-korpa", onCart);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!state) return null;

  if (!state.signedIn) {
    if (!state.loginLink) return null;
    const href = `/prijava/kupac?callbackUrl=${encodeURIComponent(pathname || "/")}`;
    return variant === "mobile" ? (
      <Link href={href} className={styles.mobileLink} onClick={onNavigate}>
        Prijava za kupce
      </Link>
    ) : (
      // Kompaktno, kao pretraga: puna reč bi sabila glavnu navigaciju.
      <Link href={href} className={styles.login} aria-label="Prijava za kupce" title="Prijava za kupce">
        <UserIcon />
      </Link>
    );
  }

  const cartLabel = state.cartCount ? `Korpa (${state.cartCount})` : "Korpa";
  // „Moj nalog“ otvara postojeći kupčev panel (dok. 61 K5).
  const links = [
    { href: "/kupac", label: "Pregled naloga" },
    { href: "/kupac/korpa", label: cartLabel },
    { href: "/kupac/fakture", label: "Fakture" },
    { href: "/kupac/porudzbine", label: "Zahtevi i porudžbine" },
    { href: "/kupac/upiti", label: "Upiti" },
    { href: "/kupac/firma", label: "Podaci firme" },
    { href: "/kupac/bezbednost", label: "Bezbednost naloga" },
  ];

  if (variant === "mobile") {
    return (
      <div className={styles.mobileBlock}>
        <span className={styles.mobileCompany}>
          <small>Prijavljeni ste</small>
          {state.company}
        </span>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.mobileLink} onClick={onNavigate}>
            {l.label}
          </Link>
        ))}
        <form action={customerSignOutAction}>
          <input type="hidden" name="returnTo" value={pathname || "/"} />
          <button type="submit" className={styles.mobileLink}>Odjavite se</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <Link href="/kupac/korpa" className={styles.cart} aria-label={state.cartCount ? `Korpa, ${state.cartCount} stavki` : "Korpa"}>
        <CartIcon />
        {state.cartCount ? <span className={styles.cartCount}>{state.cartCount}</span> : null}
      </Link>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.triggerText}>Moj nalog</span>
        <span className={styles.srOnly}>: {state.company}</span>
      </button>
      {open ? (
        <div id={menuId} className={styles.menu} role="menu">
          <p className={styles.who}>
            {state.name}
            <small>{state.company}</small>
          </p>
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <form action={customerSignOutAction}>
            <input type="hidden" name="returnTo" value={pathname || "/"} />
            <button type="submit" role="menuitem">Odjavite se</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="17.5" cy="20" r="1.2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
