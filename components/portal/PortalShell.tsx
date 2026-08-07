"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { customers, products } from "@/mock-data/portal";
import {
  can,
  canAccessCustomer,
  canAccessOrder,
  canAccessPortalPath,
  ROLE_LABELS,
} from "@/permissions/portal-permissions";
import type { Permission, UserRole } from "@/types/portal";
import { PortalIcon, type PortalIconName } from "./PortalIcon";
import { usePortal } from "./PortalProvider";
import {
  Badge,
  StateView,
  statusTone,
  useDialogDismiss,
} from "./PortalPrimitives";

const navItems: Array<{
  href: string;
  label: string;
  icon: PortalIconName;
  permission: Permission;
  count?: number;
}> = [
  {
    href: "/portal",
    label: "Početna",
    icon: "home",
    permission: "dashboard:company",
  },
  {
    href: "/portal",
    label: "Početna",
    icon: "home",
    permission: "dashboard:sales",
  },
  {
    href: "/portal",
    label: "Početna",
    icon: "home",
    permission: "dashboard:operations",
  },
  {
    href: "/portal/porudzbine",
    label: "Porudžbine",
    icon: "orders",
    permission: "orders:view_all",
    count: 7,
  },
  {
    href: "/portal/porudzbine",
    label: "Porudžbine",
    icon: "orders",
    permission: "orders:view_own",
    count: 3,
  },
  {
    href: "/portal/kupci",
    label: "Kupci",
    icon: "customers",
    permission: "customers:view_all",
  },
  {
    href: "/portal/kupci",
    label: "Kupci",
    icon: "customers",
    permission: "customers:view_own",
  },
  {
    href: "/portal/cene",
    label: "Cene i rabati",
    icon: "prices",
    permission: "prices:view",
  },
  {
    href: "/portal/proizvodi",
    label: "Proizvodi",
    icon: "products",
    permission: "products:view",
  },
  {
    href: "/portal/komercijalisti",
    label: "Komercijalisti",
    icon: "sales",
    permission: "sales_reps:view",
  },
  {
    href: "/portal/bex",
    label: "BEX",
    icon: "truck",
    permission: "integrations:bex",
    count: 2,
  },
  {
    href: "/portal/biznissoft",
    label: "BizniSoft",
    icon: "sync",
    permission: "integrations:biznisoft",
    count: 4,
  },
  {
    href: "/portal/odobrenja",
    label: "Odobrenja",
    icon: "approval",
    permission: "approvals:view",
    count: 3,
  },
  {
    href: "/portal/aktivnosti",
    label: "Aktivnosti",
    icon: "activity",
    permission: "audit:view",
  },
  {
    href: "/portal/podesavanja",
    label: "Podešavanja",
    icon: "settings",
    permission: "settings:manage",
  },
];

const crumbLabels: Record<string, string> = {
  portal: "Početna",
  porudzbine: "Porudžbine",
  nova: "Nova porudžbina",
  kupci: "Kupci",
  cene: "Cene i rabati",
  pravila: "Bulk rabati",
  istorija: "Istorija promena",
  proizvodi: "Proizvodi",
  komercijalisti: "Komercijalisti",
  bex: "BEX centar",
  biznissoft: "BizniSoft centar",
  odobrenja: "Odobrenja",
  aktivnosti: "Aktivnosti",
  podesavanja: "Podešavanja",
};

const prototypeRoles: UserRole[] = ["owner", "sales", "office"];

function CompanyMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="portal-company-mark" aria-label="Carsystem i R-M DOO">
      <span className="portal-company-symbol">
        <i />
        <i />
        <i />
      </span>
      {compact ? null : (
        <span>
          <strong>Carsystem</strong>
          <small>i R-M DOO · Inđija</small>
        </span>
      )}
    </span>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    role,
    setRole,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    uiState,
    setUiState,
    notifications,
    markNotificationRead,
    orders,
    toasts,
    signOut,
  } = usePortal();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useDialogDismiss(closeSearch, searchOpen);

  const visibleNav = useMemo(() => {
    const seen = new Set<string>();
    return navItems.filter(
      (item) =>
        can(role, item.permission) &&
        !seen.has(item.href) &&
        seen.add(item.href),
    );
  }, [role]);

  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("sr");
    if (value.length < 2) return [];
    const customerResults = customers
      .filter(
        (customer) =>
          canAccessCustomer(role, user.id, customer.salesRepId) &&
          [
            customer.companyName,
            customer.pib,
            customer.code,
            customer.city,
            customer.contacts[0]?.name,
            customer.contacts[0]?.phone,
          ].some((field) => field?.toLocaleLowerCase("sr").includes(value)),
      )
      .slice(0, 4)
      .map((customer) => ({
        type: "Kupac",
        title: customer.companyName,
        meta: `${customer.code} · PIB ${customer.pib} · ${customer.city}`,
        href: `/portal/kupci/${customer.id}`,
        icon: "customers" as const,
      }));
    const orderResults = orders
      .filter(
        (order) =>
          canAccessOrder(role, user.id, order.salesRepId) &&
          [order.number, order.customerName, order.salesRepName].some((field) =>
            field.toLocaleLowerCase("sr").includes(value),
          ),
      )
      .slice(0, 4)
      .map((order) => ({
        type: "Porudžbina",
        title: order.number,
        meta: `${order.customerName} · ${order.status}`,
        href: `/portal/porudzbine/${order.id}`,
        icon: "orders" as const,
      }));
    const productResults = can(role, "products:view")
      ? products
          .filter((product) =>
            [
              product.name,
              product.sku,
              product.catalogNumber,
              product.manufacturer,
              ...product.aliases.map((alias) => alias.value),
            ].some((field) => field.toLocaleLowerCase("sr").includes(value)),
          )
          .slice(0, 4)
          .map((product) => ({
            type: "Proizvod",
            title: product.name,
            meta: `${product.sku} · ${product.manufacturer}`,
            href: `/portal/proizvodi?product=${product.id}`,
            icon: "products" as const,
          }))
      : [];
    return [...customerResults, ...orderResults, ...productResults].slice(0, 9);
  }, [query, orders, role, user.id]);

  const visibleNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (!canAccessPortalPath(role, notification.href)) return false;
        const customerId = notification.href.match(
          /^\/portal\/kupci\/([^/?]+)/,
        )?.[1];
        const orderId = notification.href.match(
          /^\/portal\/porudzbine\/([^/?]+)/,
        )?.[1];
        if (customerId) {
          const customer = customers.find((item) => item.id === customerId);
          return customer
            ? canAccessCustomer(role, user.id, customer.salesRepId)
            : false;
        }
        if (orderId) {
          const order = orders.find((item) => item.id === orderId);
          return order
            ? canAccessOrder(role, user.id, order.salesRepId)
            : false;
        }
        return true;
      }),
    [notifications, orders, role, user.id],
  );
  const visibleUnreadCount = visibleNotifications.filter(
    (notification) => !notification.read,
  ).length;

  const crumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((part, index, all) => ({
      label:
        crumbLabels[part] ??
        (part.startsWith("ord-")
          ? (orders.find((order) => order.id === part)?.number ?? part)
          : (customers.find((customer) => customer.id === part)?.companyName ??
            part)),
      href: `/${all.slice(0, index + 1).join("/")}`,
    }));

  function changePrototypeRole(nextRole: UserRole) {
    setRole(nextRole);
    setProfileOpen(false);
    setNotificationsOpen(false);
    router.push("/portal");
  }

  useEffect(() => {
    setMobileNavOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [pathname, setMobileNavOpen]);

  useEffect(() => setActiveSearchIndex(0), [query]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setNotificationsOpen(false);
        setProfileOpen(false);
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
      if (searchOpen && searchResults.length && event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSearchIndex((current) => (current + 1) % searchResults.length);
      }
      if (searchOpen && searchResults.length && event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSearchIndex(
          (current) =>
            (current - 1 + searchResults.length) % searchResults.length,
        );
      }
      if (
        searchOpen &&
        searchResults[activeSearchIndex] &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        router.push(searchResults[activeSearchIndex].href);
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeSearchIndex, closeSearch, router, searchOpen, searchResults]);

  useEffect(() => {
    const handleOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationsOpen && !notificationsRef.current?.contains(target))
        setNotificationsOpen(false);
      if (profileOpen && !profileRef.current?.contains(target))
        setProfileOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, [notificationsOpen, profileOpen]);

  return (
    <div
      className="portal-root"
      data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
    >
      <div
        className="portal-mobile-scrim"
        data-open={mobileNavOpen}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className="portal-sidebar" data-mobile-open={mobileNavOpen}>
        <div className="portal-sidebar-brand">
          <CompanyMark compact={sidebarCollapsed} />
          <button
            type="button"
            className="portal-icon-button portal-sidebar-collapse"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={
              sidebarCollapsed ? "Proširi navigaciju" : "Skupi navigaciju"
            }
          >
            <PortalIcon name="panel" />
          </button>
        </div>
        <div className="portal-sidebar-context">
          <span>Interni portal</span>
          <Badge tone="success" dot>
            Mock okruženje
          </Badge>
        </div>
        <nav className="portal-nav" aria-label="Glavna navigacija">
          {visibleNav.map((item) => {
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
              >
                <PortalIcon name={item.icon} />
                <span>{item.label}</span>
                {item.count ? <b>{item.count}</b> : null}
              </Link>
            );
          })}
        </nav>
        <div className="portal-sidebar-foot">
          <div className="portal-integration-mini">
            <span>
              <i data-status="ok" />
              Servisi
            </span>
            <strong>2 / 2 online</strong>
          </div>
          <small>Frontend prototip · bez servera</small>
        </div>
      </aside>

      <div className="portal-workspace">
        <header className="portal-topbar">
          <div className="portal-topbar-start">
            <button
              type="button"
              className="portal-icon-button portal-mobile-menu"
              onClick={() => setMobileNavOpen(true)}
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
            {process.env.NODE_ENV !== "production" ? (
              <div className="portal-prototype-role-switcher">
                <span>Prototip uloga</span>
                <div role="group" aria-label="Prototip uloga">
                  {prototypeRoles.map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={role === item}
                      onClick={() => changePrototypeRole(item)}
                    >
                      {ROLE_LABELS[item]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="portal-search-trigger"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              onClick={() => {
                setNotificationsOpen(false);
                setProfileOpen(false);
                setSearchOpen(true);
              }}
            >
              <PortalIcon name="search" />
              <span>Pretraži kupca, PIB, artikal…</span>
              <kbd>⌘ K</kbd>
            </button>
            <Link href="/portal/porudzbine/nova" className="portal-quick-order">
              <PortalIcon name="plus" />
              <span>Nova porudžbina</span>
            </Link>
            <div
              className="portal-status-trigger"
              aria-label="Status integracija"
            >
              <i data-status="ok" />
              <span>Integracije</span>
            </div>
            <div className="portal-popover-wrap" ref={notificationsRef}>
              <button
                type="button"
                className="portal-icon-button"
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setProfileOpen(false);
                }}
                aria-label={`${visibleUnreadCount} novih obaveštenja`}
              >
                <PortalIcon name="bell" />
                {visibleUnreadCount ? (
                  <b className="portal-unread-count">{visibleUnreadCount}</b>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div
                  className="portal-popover portal-notification-popover"
                  role="menu"
                >
                  <div className="portal-popover-head">
                    <strong>Obaveštenja</strong>
                    <span>{visibleUnreadCount} novih</span>
                  </div>
                  {visibleNotifications.slice(0, 6).map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.href}
                      role="menuitem"
                      className="portal-notification-item"
                      data-read={notification.read}
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      <i data-tone={statusTone(notification.type)} />
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.description}</small>
                      </span>
                      <time>
                        {new Date(notification.createdAt).toLocaleTimeString(
                          "sr-RS",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </time>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="portal-popover-wrap" ref={profileRef}>
              <button
                type="button"
                className="portal-user-trigger"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
              >
                <span className="portal-avatar">{user.initials}</span>
                <span>
                  <strong>{user.name}</strong>
                  <small>{ROLE_LABELS[role]}</small>
                </span>
                <PortalIcon name="chevron" />
              </button>
              {profileOpen ? (
                <div
                  className="portal-popover portal-profile-popover"
                  role="menu"
                >
                  {process.env.NODE_ENV !== "production" ? (
                    <label>
                      Prototip uloga
                      <select
                        value={role}
                        onChange={(event) =>
                          changePrototypeRole(event.target.value as UserRole)
                        }
                      >
                        <option value="owner">Gazda</option>
                        <option value="sales">Komercijalista</option>
                        <option value="office">Sekretarica</option>
                      </select>
                    </label>
                  ) : null}
                  <label>
                    Demo stanje
                    <select
                      value={uiState}
                      onChange={(event) =>
                        setUiState(event.target.value as typeof uiState)
                      }
                    >
                      <option value="normal">Normalno</option>
                      <option value="loading">Učitavanje</option>
                      <option value="empty">Prazno</option>
                      <option value="error">Greška</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      signOut();
                      window.location.assign("/portal/prijava");
                    }}
                  >
                    <PortalIcon name="logout" />
                    Odjavi se
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="portal-main">
          {canAccessPortalPath(role, pathname) ? (
            children
          ) : (
            <StateView state="permission" />
          )}
        </main>
      </div>

      {searchOpen ? (
        <div
          className="portal-command-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Globalna pretraga"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeSearch();
          }}
        >
          <div className="portal-command">
            <div className="portal-command-input">
              <PortalIcon name="search" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kupac, PIB, šifra, porudžbina, proizvod, telefon…"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Zatvori globalnu pretragu"
              >
                <span>ESC</span>
                <PortalIcon name="close" />
              </button>
            </div>
            <div className="portal-command-results">
              {query.length < 2 ? (
                <div className="portal-command-hint">
                  <PortalIcon name="spark" />
                  <strong>Pretražite ceo portal</strong>
                  <span>
                    Probajte „Auto Color“, „108234560“, „PO-2026“ ili „SIA 150“.
                  </span>
                </div>
              ) : searchResults.length ? (
                searchResults.map((result, index) => (
                  <Link
                    href={result.href}
                    key={`${result.type}-${result.title}`}
                    data-active={activeSearchIndex === index}
                    onMouseMove={() => setActiveSearchIndex(index)}
                  >
                    <span className="portal-command-result-icon">
                      <PortalIcon name={result.icon} />
                    </span>
                    <span>
                      <small>{result.type}</small>
                      <strong>{result.title}</strong>
                      <em>{result.meta}</em>
                    </span>
                    <PortalIcon name="arrow" />
                  </Link>
                ))
              ) : (
                <div className="portal-command-hint">
                  <PortalIcon name="search" />
                  <strong>Nema rezultata</strong>
                  <span>Proverite naziv, PIB, šifru ili broj telefona.</span>
                </div>
              )}
            </div>
            <div className="portal-command-foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigacija
              </span>
              <span>
                <kbd>Enter</kbd> otvori
              </span>
              <span>Pretraga kroz dozvoljene mock podatke</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="portal-toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className="portal-toast" data-tone={toast.tone} key={toast.id}>
            <PortalIcon name={toast.tone === "warning" ? "warning" : "check"} />
            <span>
              <strong>{toast.title}</strong>
              {toast.description ? <small>{toast.description}</small> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signedIn, sessionReady } = usePortal();
  useEffect(() => {
    if (sessionReady && !signedIn && pathname !== "/portal/prijava")
      router.replace("/portal/prijava");
  }, [pathname, router, sessionReady, signedIn]);
  if (pathname === "/portal/prijava") return <>{children}</>;
  if (!sessionReady || !signedIn)
    return (
      <div className="portal-root">
        <main className="portal-main">
          <StateView state="loading" />
        </main>
      </div>
    );
  return <PortalShell>{children}</PortalShell>;
}
