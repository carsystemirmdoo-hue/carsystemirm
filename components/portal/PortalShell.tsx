"use client";

import { fallbackRecordLabel, useCrumbLabels } from "@/components/portal/Breadcrumbs";

import { CartButton } from "@/components/cart/CartButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/authz/permissions.mjs";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoSortTables } from "./AutoSortTables";
import { NotificationBell } from "./NotificationBell";
import { PortalNavProgress } from "./PortalNavProgress";
import { PortalIcon, type PortalIconName } from "./PortalIcon";
import {
  sidebarCookieValue,
  SIDEBAR_PREFERENCE_KEY,
} from "./sidebarState.mjs";

/** Delovi putanje bez sopstvene stranice: tekst, ne link (inače pregledač unapred traži 404). */

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
  /** Korpa se prikazuje samo kada portal commerce kapija to dozvoli. */
  showCart?: boolean;
  /** Zvonce samo uz pravo na ekran Obaveštenja (magacioner ga nema → bez 403). */
  showNotifications?: boolean;
  children: React.ReactNode;
  /** Traka iznad sadržaja (npr. oznaka demo podataka); ništa ne prekriva. */
  dataNotice?: React.ReactNode;
  /** Kratko stanje izvora za dno navigacije (demo, dokumenti do datuma, nepovezan). */
  dataSource?: { status: "ok" | "warn"; label: string };
}

/** Svi ekrani iz menija, za sve uloge — da bi se znalo koji segment putanje je zaključan ekran. */
/**
 * Segmenti putanje bez sopstvene strane: veza bi vodila na 404 (a Next je
 * unapred učitava, pa svaka strana ispod pravi grešku u konzoli).
 */
const CRUMBS_WITHOUT_PAGE: ReadonlySet<string> = new Set(["/portal/bezbednost", "/portal/prodaja/faktura"]);

const ALL_NAV_HREFS: ReadonlySet<string> = new Set(
  (NAV_GROUPS as readonly { items: readonly { href: string }[] }[]).flatMap((group) => group.items.map((item) => item.href)),
);

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
  porudzbine: "Roba u dolasku",
  otprema: "Otprema",
  adresnice: "Adresnice",
  bex: "BEX",
  obavestenja: "Obaveštenja",
  izvestaji: "Izveštaji",
  importi: "Importi",
  dozvole: "Korisnici i dozvole",
  admin: "Administracija",
  aktivnosti: "Aktivnosti",
  bezbednost: "Bezbednost",
  cene: "Cene i rabati",
  preporuke: "Preporuke",
  mapiranja: "Mapiranja",
  proizvodi: "Proizvodi",
  sinhronizacija: "Sinhronizacija",
  spremnost: "Spremnost podataka",
  kontakti: "Kontakti",
  veze: "Veze šifara",
  nalozi: "Nalozi",
  partneri: "Registar partnera",
  "bez-dodele": "Bez komercijaliste",
  dokumenti: "Izvorni dokumenti",
  faktura: "Faktura",
  stampa: "Štampa",
  uslovi: "Cena i uslovi",
  zahtevi: "Zahtevi kupaca",
  nova: "Nova",
  lozinka: "Lozinka",
  mfa: "Drugi faktor",
  cenovnik: "Cenovnik",
  istorija: "Istorija pravila",
  pravila: "Pravila",
  odobravanje: "Odobravanje cena",
  "rabati-iz-faktura": "Rabati iz faktura",
  "grupe-artikala": "Grupe artikala",
  predlozi: "Grupni predlozi",
  "za-pregled": "Za ručni pregled",
  "za-razgovor": "Za razgovor",
  tabela: "Tabela rabata",
  promene: "Promene komercijalista",
  komercijalisti: "Komercijalisti",
  podesavanja: "Podešavanja",
  odobrenja: "Odobrenja",
  biznissoft: "BizniSoft",
};

function CompanyMark() {
  return (
    // Bez znaka sa trakama (odluka vlasnika 2026-11-09): samo naziv.
    <span className="portal-company-mark" aria-label="Carsystem i R-M">
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
  showCart = false,
  showNotifications = true,
  dataNotice = null,
  dataSource = { status: "warn", label: "nije povezan" },
}: PortalShellProps) {
  const pathname = usePathname();
  const crumbLabels = useCrumbLabels();
  // Isti nazivi kao u navigaciji: „Nalozi kupaca", ne „nalozi".
  const navLabels = useMemo(
    () => new Map(navGroups.flatMap((group) => group.items.map((item) => [item.href, item.label] as const))),
    [navGroups],
  );
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const crumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      // Ekran iz menija koji OVOM korisniku nije dodeljen (npr. „Zalihe“ za
      // kancelariju na „Uvozu lagera“) ostaje u putanji kao tekst — veza bi
      // vodila na 403. Ostali segmenti (zapisi, podstrane) ostaju veze.
      linkable:
        !CRUMBS_WITHOUT_PAGE.has(`/${segments.slice(0, index + 1).join("/")}`) &&
        (navLabels.has(`/${segments.slice(0, index + 1).join("/")}`) ||
          !ALL_NAV_HREFS.has(`/${segments.slice(0, index + 1).join("/")}`)),
      // Nepoznat segment je najčešće ID zapisa; prikazuje se onakav kakav jeste.
      label:
        navLabels.get(`/${segments.slice(0, index + 1).join("/")}`) ??
        CRUMB_LABELS[segment] ??
        crumbLabels[segment] ??
        fallbackRecordLabel(segment, segments[index - 1]) ??
        decodeURIComponent(segment),
    }));
  }, [pathname, crumbLabels, navLabels]);

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
            aria-label={collapsed ? "Proširite navigaciju" : "Skupite navigaciju"}
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
              <i data-status={dataSource.status} />
              Izvor podataka
            </span>
            <strong>{dataSource.label}</strong>
          </div>
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
              aria-label="Otvorite navigaciju"
            >
              <PortalIcon name="menu" />
            </button>
            <nav className="portal-breadcrumb" aria-label="Putanja">
              {crumbs.map((crumb, index) => (
                <span key={crumb.href}>
                  {index ? <PortalIcon name="chevron" /> : null}
                  {index === crumbs.length - 1 ? (
                    <strong>{crumb.label}</strong>
                  ) : !crumb.linkable ? (
                    <span>{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="portal-topbar-actions">
            {/* Globalna pretraga stiže u fazi 2, zajedno sa uvozom faktura.
                Do tada se polje ne prikazuje (sistem A, 2026-10-14): nedovršen
                element u traci je izgledao kao kvar. Stil `.portal-search-trigger`
                ostaje u portal.css za trenutak kada pretraga proradi. */}
            {showNotifications ? <NotificationBell /> : null}

            {showCart ? <CartButton /> : null}
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

        {dataNotice}
        <Suspense fallback={null}>
          <PortalNavProgress />
          <AutoSortTables />
        </Suspense>
        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
