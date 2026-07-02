"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type FocusEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  BRAND_LINKS,
  MAIN_LINKS,
  PROGRAM_LINKS,
  type MegaLink,
  type NavLink,
} from "@/components/layout/navigation-data";
import styles from "./Header.module.css";

type DropdownKey = "programi" | "brendovi";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function publicPathname(pathname: string) {
  const path =
    pathname === "/preview"
      ? "/"
      : pathname.startsWith("/preview/")
        ? pathname.slice("/preview".length)
        : pathname;

  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

function isActive(activeKey: NavLink["activeKey"], pathname: string) {
  if (activeKey === "home") return pathname === "/";
  if (activeKey === "katalog") {
    return pathname === "/katalog" || pathname.startsWith("/katalog/") || pathname.startsWith("/proizvodi/");
  }

  return pathname === `/${activeKey}` || pathname.startsWith(`/${activeKey}/`);
}

function isExactOrChild(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = publicPathname(usePathname());
  const programPanelId = useId();
  const brandPanelId = useId();
  const mobilePanelId = useId();
  const mobileProgramId = useId();
  const mobileBrandId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<DropdownKey | null>("programi");
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);

  const programActive = pathname === "/program" || pathname.startsWith("/program/");
  const brandActive = pathname === "/brendovi" || pathname.startsWith("/brendovi/");

  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
    setHeaderHidden(false);
    setHeaderCompact(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    let previousY = window.scrollY;
    let ticking = false;

    function updateHeaderVisibility() {
      const nextY = window.scrollY;
      const delta = nextY - previousY;

      setHeaderCompact(nextY > 24);
      setHeaderHidden(nextY > 132 && delta > 0);

      if (delta < -6 || nextY < 48) {
        setHeaderHidden(false);
      }

      previousY = Math.max(nextY, 0);
      ticking = false;
    }

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeaderVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateHeaderVisibility();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleDropdownBlur(event: FocusEvent<HTMLDivElement>, dropdown: DropdownKey) {
    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setOpenDropdown((current) => (current === dropdown ? null : current));
    }
  }

  function toggleMobileSection(section: DropdownKey) {
    setMobileSection((current) => (current === section ? null : section));
  }

  function closeMobileNav() {
    setMobileOpen(false);
  }

  return (
    <header
      ref={headerRef}
      className={styles.header}
      data-compact={headerCompact || undefined}
      data-hidden={headerHidden && !mobileOpen ? true : undefined}
    >
      <div className={styles.shell}>
        <Link
          href="/"
          className={styles.brandMark}
          aria-label="Carsystem i R-M Inđija početna"
          aria-current={pathname === "/" ? "page" : undefined}
        >
          <span className={styles.brandSymbol} aria-hidden="true">
            RM
          </span>
          <span className={styles.brandText}>
            <span>Carsystem</span>
            <strong>R-M Inđija</strong>
          </span>
        </Link>

        <nav aria-label="Glavna navigacija" className={styles.desktopNav}>
          <Link
            href={MAIN_LINKS[0].href}
            className={cx(styles.navLink, "cs-link-reveal")}
            aria-current={isActive(MAIN_LINKS[0].activeKey, pathname) ? "page" : undefined}
            data-active={isActive(MAIN_LINKS[0].activeKey, pathname) || undefined}
            data-cursor="link"
          >
            {MAIN_LINKS[0].label}
          </Link>

          <Link
            href={MAIN_LINKS[1].href}
            className={cx(styles.navLink, "cs-link-reveal")}
            aria-current={isActive(MAIN_LINKS[1].activeKey, pathname) ? "page" : undefined}
            data-active={isActive(MAIN_LINKS[1].activeKey, pathname) || undefined}
            data-cursor="link"
          >
            {MAIN_LINKS[1].label}
          </Link>

          <DesktopMegaMenu
            id={programPanelId}
            label="Programi"
            active={programActive}
            open={openDropdown === "programi"}
            onOpen={() => setOpenDropdown("programi")}
            onToggle={() =>
              setOpenDropdown((current) => (current === "programi" ? null : "programi"))
            }
            onClose={() => setOpenDropdown(null)}
            onBlur={(event) => handleDropdownBlur(event, "programi")}
            featured={{
              href: "/program",
              title: "Program po fazama refinish procesa",
              description:
                "Priprema, podloga, boja, lak i poliranje povezani sa proizvodima i brendovima.",
              cta: "Pogledaj sve programe",
            }}
            links={PROGRAM_LINKS}
            pathname={pathname}
          />

          <DesktopMegaMenu
            id={brandPanelId}
            label="Brendovi"
            active={brandActive}
            open={openDropdown === "brendovi"}
            onOpen={() => setOpenDropdown("brendovi")}
            onToggle={() =>
              setOpenDropdown((current) => (current === "brendovi" ? null : "brendovi"))
            }
            onClose={() => setOpenDropdown(null)}
            onBlur={(event) => handleDropdownBlur(event, "brendovi")}
            featured={{
              href: "/brendovi",
              title: "Brendovi u Carsystem i R-M programu",
              description:
                "Profesionalni refinish sistemi, oprema i potrošni materijal kroz mrežu partnera.",
              cta: "Pogledaj sve brendove",
            }}
            links={BRAND_LINKS}
            pathname={pathname}
            withLogos
          />

          {MAIN_LINKS.slice(2).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cx(styles.navLink, "cs-link-reveal")}
              aria-current={isActive(link.activeKey, pathname) ? "page" : undefined}
              data-active={isActive(link.activeKey, pathname) || undefined}
              data-cursor="link"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link
            href="/prodavnice"
            className={cx(styles.cta, styles.secondaryCta, "cs-interactive-surface")}
            data-cursor="button"
            data-motion-surface
          >
            Pronađi prodavnicu
          </Link>
          <Link
            href="/kontakt"
            className={cx(styles.cta, styles.primaryCta, "cs-magnetic-cta cs-theme-wipe-card")}
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
          >
            <span>Pošalji upit</span>
          </Link>
          <span className={styles.themeSlot}>
            <ThemeToggle />
          </span>
          <button
            type="button"
            className={styles.mobileToggle}
            aria-label={mobileOpen ? "Zatvori meni" : "Otvori meni"}
            aria-controls={mobilePanelId}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={styles.mobileLayer}>
          <button
            type="button"
            className={styles.mobileScrim}
            aria-label="Zatvori meni"
            onClick={closeMobileNav}
          />
          <nav
            id={mobilePanelId}
            className={styles.mobilePanel}
            aria-label="Mobilna navigacija"
          >
            <div className={styles.mobilePanelHeader}>
              <span>
                Carsystem <strong>R-M</strong>
              </span>
              <button
                type="button"
                className={styles.mobileClose}
                aria-label="Zatvori meni"
                onClick={closeMobileNav}
              >
                <span />
                <span />
              </button>
            </div>

            <div className={styles.mobileSectionList}>
              <MobileLink
                href="/katalog"
                label="Katalog"
                active={isActive("katalog", pathname)}
                onClick={closeMobileNav}
              />

              <MobileAccordion
                id={mobileProgramId}
                label="Programi"
                active={programActive}
                href="/program"
                open={mobileSection === "programi"}
                onNavigate={closeMobileNav}
                onToggle={() => toggleMobileSection("programi")}
              >
                <MobileLink href="/program" label="Svi programi" active={pathname === "/program"} onClick={closeMobileNav} />
                {PROGRAM_LINKS.map((link) => (
                  <MobileLink
                    key={link.href}
                    href={link.href}
                    label={link.title}
                    active={isExactOrChild(link.href, pathname)}
                    onClick={closeMobileNav}
                  />
                ))}
              </MobileAccordion>

              <MobileAccordion
                id={mobileBrandId}
                label="Brendovi"
                active={brandActive}
                href="/brendovi"
                open={mobileSection === "brendovi"}
                onNavigate={closeMobileNav}
                onToggle={() => toggleMobileSection("brendovi")}
              >
                <MobileLink href="/brendovi" label="Svi brendovi" active={pathname === "/brendovi"} onClick={closeMobileNav} />
                {BRAND_LINKS.map((link) => (
                  <MobileLink
                    key={link.href}
                    href={link.href}
                    label={link.title}
                    active={isExactOrChild(link.href, pathname)}
                    onClick={closeMobileNav}
                  />
                ))}
              </MobileAccordion>

              <MobileLink
                href="/prodavnice"
                label="Prodavnice"
                active={isActive("prodavnice", pathname)}
                onClick={closeMobileNav}
              />
              <MobileLink
                href="/kontakt"
                label="Kontakt"
                active={isActive("kontakt", pathname)}
                onClick={closeMobileNav}
              />
            </div>

            <div className={styles.mobileActions}>
              <Link href="/kontakt" className={styles.mobilePrimary} onClick={closeMobileNav}>
                Pošalji upit
              </Link>
              <Link href="/prodavnice" className={styles.mobileSecondary} onClick={closeMobileNav}>
                Pronađi prodavnicu
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function DesktopMegaMenu({
  id,
  label,
  active,
  open,
  onOpen,
  onToggle,
  onClose,
  onBlur,
  featured,
  links,
  pathname,
  withLogos = false,
}: {
  id: string;
  label: string;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onClose: () => void;
  onBlur: (event: FocusEvent<HTMLDivElement>) => void;
  featured: {
    href: string;
    title: string;
    description: string;
    cta: string;
  };
  links: MegaLink[];
  pathname: string;
  withLogos?: boolean;
}) {
  return (
    <div
      className={styles.navItem}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={onBlur}
      data-open={open || undefined}
    >
      <span className={styles.navTrigger} data-active={active || undefined}>
        <Link
          className={cx(styles.navTriggerLabel, "cs-link-reveal")}
          href={featured.href}
          aria-current={active ? "page" : undefined}
          data-cursor="link"
          onClick={onClose}
        >
          {label}
        </Link>
        <button
          type="button"
          className={styles.navChevronButton}
          data-cursor="button"
          data-motion-surface
          aria-label={`${open ? "Sakrij" : "Prikaži"} ${label.toLowerCase()} meni`}
          aria-expanded={open}
          aria-controls={id}
          aria-haspopup="true"
          onClick={onToggle}
        >
          <span className={styles.triggerChevron} aria-hidden="true" />
        </button>
      </span>

      {open && (
        <div id={id} className={styles.megaPanel} aria-label={`${label} navigacija`}>
          <Link
            href={featured.href}
            className={cx(styles.featuredCard, "cs-gloss-card")}
            onClick={onClose}
            aria-current={pathname === featured.href ? "page" : undefined}
            data-cursor="card"
            data-motion-surface
          >
            <span className={styles.featuredKicker}>Pregled sistema</span>
            <strong>{featured.title}</strong>
            <span>{featured.description}</span>
            <em>{featured.cta}</em>
          </Link>

          <div className={cx(styles.megaLinks, withLogos && styles.brandMegaLinks)}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx(styles.megaLink, "cs-gloss-card")}
                onClick={onClose}
                aria-current={isExactOrChild(link.href, pathname) ? "page" : undefined}
                data-active={isExactOrChild(link.href, pathname) || undefined}
                data-cursor={withLogos ? "image" : "card"}
                data-motion-surface
              >
                {withLogos ? (
                  <span className={styles.logoChip} aria-hidden="true">
                    {link.logo ? (
                      <Image
                        src={link.logo}
                        alt=""
                        width={96}
                        height={56}
                        className={styles.brandLogo}
                      />
                    ) : (
                      <span className={styles.logoTextMark}>{link.title}</span>
                    )}
                  </span>
                ) : (
                  <span className={styles.itemMarker} aria-hidden="true" />
                )}
                <span className={styles.megaLinkCopy}>
                  <strong>{link.title}</strong>
                  <span>{link.description}</span>
                  {link.meta ? <small>{link.meta}</small> : null}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileAccordion({
  id,
  label,
  active,
  href,
  open,
  onNavigate,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  href: string;
  open: boolean;
  onNavigate: () => void;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.mobileGroup} data-active={active || undefined}>
      <div className={styles.mobileGroupTrigger}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          {label}
        </Link>
        <button
          type="button"
          aria-label={`${open ? "Sakrij" : "Prikaži"} ${label.toLowerCase()} meni`}
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <span className={styles.mobileChevron} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div id={id} className={styles.mobileGroupLinks}>
          {children}
        </div>
      )}
    </section>
  );
}

function MobileLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      className={styles.mobileLink}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}
