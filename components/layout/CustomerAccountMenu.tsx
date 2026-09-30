"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { customerSignOutAction } from "@/app/prijava/kupac/actions";
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
    load();
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
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

  const links = [
    { href: "/kupac", label: "Pregled naloga" },
    { href: "/kupac/korpa", label: state.cartCount ? `Korpa (${state.cartCount})` : "Korpa" },
    { href: "/kupac/fakture", label: "Fakture" },
    { href: "/kupac/porudzbine", label: "Porudžbine" },
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
          <button type="submit" className={styles.mobileLink}>Odjavi se</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.root} ref={rootRef}>
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
            <button type="submit" role="menuitem">Odjavi se</button>
          </form>
        </div>
      ) : null}
    </div>
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
