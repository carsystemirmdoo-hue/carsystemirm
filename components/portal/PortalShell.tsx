"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PortalIcon, type PortalIconName } from "./PortalIcon";
import {
  sidebarCookieValue,
  SIDEBAR_PREFERENCE_KEY,
} from "./sidebarState.mjs";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: PortalIconName;
}

export interface ShellNavGroup {
  label: string;
  items: ShellNavItem[];
}

export interface ShellUser {
  name: string;
  initials: string;
  roleLabel: string;
}

interface PortalShellProps {
  user: ShellUser;
  navGroups: ShellNavGroup[];
  /** Pročitano iz kolačića na serveru, da navigacija ne bljesne pri učitavanju. */
  initialCollapsed: boolean;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}

const CRUMB_LABELS: Record<string, string> = {
  portal: "Poslovni sistem",
  analitika: "Analitika",
  kupci: "Kupci",
  prodaja: "Prodaja",
  povrati: "Povrati i minus fakture",
  dugovanja: "Dugovanja",
  limiti: "Kreditni limiti",
  zalihe: "Zalihe",
  nabavka: "Nabavka",
  porudzbine: "Porudžbine",
  otprema: "Otprema",
  adresnice: "Adresnice",
  bex: "BEX",
  obavestenja: "Obaveštenja",
  izvestaji: "Izveštaji",
  importi: "Importi",
  dozvole: "Korisnici i dozvole",
  admin: "Administracija",
  aktivnosti: "Aktivnosti",
};

function CompanyMark() {
  return (
    <span className="portal-company-mark" aria-label="Carsystem i R-M DOO">
      <span className="portal-company-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <strong>Carsystem</strong>
        <small>Poslovni sistem</small>
      </span>
    </span>
  );
}

export function PortalShell({
  user,
  navGroups,
  initialCollapsed,
  onSignOut,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const crumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      // Nepoznat segment je najčešće ID zapisa; prikazuje se onakav kakav jeste.
      label: CRUMB_LABELS[segment] ?? decodeURIComponent(segment),
    }));
  }, [pathname]);

  /**
   * Prebacivanje menja isključivo širinu navigacije. Nema navigacije ni
   * ponovnog montiranja, pa tekuća strana, filteri, sortiranje i skrol ostaju
   * netaknuti. Vrednost se odmah upisuje u kolačić (za prvo iscrtavanje) i u
   * podešavanja naloga (da izbor prati korisnika na drugom računaru).
   */
  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = sidebarCookieValue(next);
      void fetch("/api/portal/podesavanja/navigacija", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SIDEBAR_PREFERENCE_KEY, value: next }),
        keepalive: true,
      }).catch(() => {
        // Kolačić je već upisan — neuspeh upisa u nalog ne sme da prekine rad.
      });
      return next;
    });
  }, []);

  /**
   * Postavlja oblačić uz ikonicu. Navigacija ima `overflow: hidden` zbog
   * skrolovanja, pa oblačić mora biti `position: fixed` — a to znači da
   * koordinate moraju da se izračunaju u trenutku prikaza.
   */
  const showTip = useCallback(
    (event: React.MouseEvent | React.FocusEvent) => {
      if (!collapsed) return;
      const link = event.currentTarget as HTMLElement;
      const tip = link.querySelector<HTMLElement>(".portal-nav-tip");
      if (!tip) return;
      const rect = link.getBoundingClientRect();
      tip.style.top = `${rect.top + rect.height / 2}px`;
      tip.style.left = `${rect.right + 12}px`;
    },
    [collapsed],
  );

  // Fioka na telefonu se zatvara posle navigacije.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const sidebar = sidebarRef.current;
    const focusable = sidebar?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled)',
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !focusable || focusable.length === 0) return;

      // Fokus ostaje unutar fioke dok je otvorena.
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="portal-root" data-sidebar={collapsed ? "collapsed" : "expanded"}>
      <div
        className="portal-mobile-scrim"
        data-open={mobileOpen}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        ref={sidebarRef}
        className="portal-sidebar"
        data-mobile-open={mobileOpen}
        aria-label="Glavna navigacija"
      >
        <div className="portal-sidebar-brand">
          <CompanyMark />
          <button
            type="button"
            className="portal-icon-button portal-sidebar-collapse"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Proširi navigaciju" : "Skupi navigaciju"}
          >
            <PortalIcon name="panel" />
          </button>
        </div>

        <nav className="portal-nav">
          {navGroups.map((group) => (
            <div className="portal-nav-group" key={group.label}>
              <div className="portal-nav-group-label" aria-hidden="true">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active =
                  item.href === "/portal"
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    className="portal-nav-link"
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={showTip}
                    onFocus={showTip}
                  >
                    <PortalIcon name={item.icon} />
                    {/* Naziv ostaje u stablu pristupačnosti i kada je skupljeno —
                        vizuelno se sakriva, ali ga čitač ekrana i dalje izgovara. */}
                    <span className="portal-nav-label">{item.label}</span>
                    <span className="portal-nav-tip" role="tooltip" aria-hidden="true">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="portal-sidebar-foot">
          <div className="portal-integration-mini">
            <span>
              <i data-status="warn" />
              Izvor podataka
            </span>
            <strong>nije povezan</strong>
          </div>
          <small>Uplate nisu dostupne iz faktura</small>
        </div>
      </aside>

      <div className="portal-workspace">
        <header className="portal-topbar">
          <div className="portal-topbar-start">
            <button
              type="button"
              ref={menuButtonRef}
              className="portal-icon-button portal-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-label="Otvori navigaciju"
            >
              <PortalIcon name="menu" />
            </button>
            <nav className="portal-breadcrumb" aria-label="Putanja">
              {crumbs.map((crumb, index) => (
                <span key={crumb.href}>
                  {index ? <PortalIcon name="chevron" /> : null}
                  {index === crumbs.length - 1 ? (
                    <strong>{crumb.label}</strong>
                  ) : (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="portal-topbar-actions">
            {/* Globalna pretraga stiže u fazi 2, zajedno sa uvozom faktura.
                Do tada stoji izričito onemogućena, umesto da izgleda upotrebljivo. */}
            <div
              className="portal-search-trigger"
              data-disabled="true"
              aria-disabled="true"
              title="Pretraga se uključuje kada fakture budu uvezene (faza 2)"
            >
              <PortalIcon name="search" />
              <span>Pretraga stiže sa uvozom faktura</span>
            </div>

            <Link
              href="/portal/obavestenja"
              className="portal-icon-button"
              aria-label="Obaveštenja"
            >
              <PortalIcon name="bell" />
            </Link>

            <div className="portal-profile">
              <span className="portal-profile-avatar" aria-hidden="true">
                {user.initials}
              </span>
              <span className="portal-profile-meta">
                <strong>{user.name}</strong>
                <small>{user.roleLabel}</small>
              </span>
              <form action={onSignOut}>
                <button
                  type="submit"
                  className="portal-icon-button"
                  aria-label="Odjava"
                >
                  <PortalIcon name="logout" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
