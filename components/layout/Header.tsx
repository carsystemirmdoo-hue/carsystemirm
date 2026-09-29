"use client";

/* eslint-disable @next/next/no-img-element -- Approved brand and category assets are static public SVG files. */
import Image from "next/image";
import Link from "next/link";
import { CustomerAccountMenu } from "./CustomerAccountMenu";
import { usePathname } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ProductCategoryGrid } from "@/components/categories/ProductCategoryGrid";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useProductSearchDialog } from "@/components/search/ProductSearchProvider";
import { useMotionTransitionState } from "@/components/motion/MotionConfigProvider";
import { Button } from "@/components/ui/Button";
import { HEADER_ENTRANCE_STORAGE_KEY } from "@/lib/header-entrance";
import {
  BRAND_LINKS,
  type HeaderIconName,
  type HeaderMenuKey,
  type NavigationLink,
  PRODUCT_CATEGORIES,
  SUPPORT_LINKS,
  SYSTEM_GROUPS,
} from "@/components/layout/navigation-data";
import styles from "./Header.module.css";

const DESKTOP_MENU_KEYS: HeaderMenuKey[] = [
  "proizvodi",
  "brendovi",
  "sistemi",
  "podrska",
];

type TriggerRefs = Record<HeaderMenuKey, HTMLButtonElement | null>;
type HeaderEntranceState = "pending" | "entered" | "visible";
type DesktopMenuState = "closed" | "opening" | "open" | "closing";

const DESKTOP_HOVER_OPEN_DELAY_MS = 100;
const DESKTOP_HOVER_CLOSE_DELAY_MS = 250;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function publicPathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

function isPathActive(href: string, pathname: string) {
  const hrefPath = href.split(/[?#]/)[0] || "/";
  if (hrefPath === "/") return pathname === "/";
  if (hrefPath === "/katalog") {
    return pathname === "/katalog" || pathname.startsWith("/proizvodi/");
  }
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function isMenuLinkActive(href: string, pathname: string) {
  if (href.includes("?") || href.includes("#")) return false;
  return isPathActive(href, pathname);
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}

export function Header() {
  const pathname = publicPathname(usePathname());
  const { phase: transitionPhase, reducedMotion } = useMotionTransitionState();
  const { openSearch } = useProductSearchDialog();
  const productPanelId = useId();
  const brandPanelId = useId();
  const systemPanelId = useId();
  const supportPanelId = useId();
  const mobilePanelId = useId();
  const mobileProductId = useId();
  const mobileBrandId = useId();
  const mobileSystemId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const headerShellRef = useRef<HTMLDivElement>(null);
  const desktopLayerRef = useRef<HTMLDivElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  /** Lupa u desktop akcijama — i okidač panela i mesto povratka fokusa. */
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  /** Mobilna navigacija predaje fokus panelu pretrage, ne vraća ga na hamburger. */
  const handoffFocusRef = useRef(false);
  const mobileHistoryEntryRef = useRef(false);
  const openMenuRef = useRef<HeaderMenuKey | null>(null);
  const desktopHoverOpenTimerRef = useRef<number | null>(null);
  const desktopHoverCloseTimerRef = useRef<number | null>(null);
  const desktopSwitchFrameRef = useRef<number | null>(null);
  const desktopOpenFrameRef = useRef<number | null>(null);
  const desktopFocusFrameRef = useRef<number | null>(null);
  const desktopMenuStateRef = useRef<DesktopMenuState>("closed");
  const scrollFrameRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const restoreDesktopFocusRef = useRef(false);
  const focusDesktopPanelOnOpenRef = useRef(false);
  const entranceStartedRef = useRef(false);
  const triggerRefs = useRef<TriggerRefs>({
    proizvodi: null,
    brendovi: null,
    sistemi: null,
    podrska: null,
  });
  const [openMenu, setOpenMenu] = useState<HeaderMenuKey | null>(null);
  const [desktopMenuState, setDesktopMenuState] =
    useState<DesktopMenuState>("closed");
  const [desktopMenuSwitching, setDesktopMenuSwitching] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLayerMounted, setMobileLayerMounted] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [mobileSection, setMobileSection] = useState<HeaderMenuKey | null>(
    "proizvodi",
  );
  const [entranceState, setEntranceState] =
    useState<HeaderEntranceState>("pending");

  const productActive =
    pathname === "/katalog" || pathname.startsWith("/proizvodi/");
  const brandActive =
    pathname === "/brendovi" || pathname.startsWith("/brendovi/");
  const systemActive =
    pathname === "/program" || pathname.startsWith("/program/");
  const storeActive =
    pathname === "/prodavnice" || pathname.startsWith("/prodavnice/");
  const katalozActive =
    pathname === "/katalozi" || pathname.startsWith("/katalozi/");
  const supportActive = pathname === "/kontakt";

  const revealHeader = useCallback((animate: boolean) => {
    if (entranceStartedRef.current) return;
    entranceStartedRef.current = true;

    try {
      window.sessionStorage.setItem(HEADER_ENTRANCE_STORAGE_KEY, "seen");
      document.documentElement.dataset.headerEntrance = "seen";
    } catch {
      // Entrance still runs if sessionStorage is unavailable.
    }

    setEntranceState(animate ? "entered" : "visible");
  }, []);

  const setDesktopMenuPhase = useCallback((state: DesktopMenuState) => {
    desktopMenuStateRef.current = state;
    setDesktopMenuState(state);
  }, []);

  const updateDesktopMenuGeometry = useCallback((menu: HeaderMenuKey) => {
    const shell = headerShellRef.current;
    const layer = desktopLayerRef.current;
    const trigger = triggerRefs.current[menu];
    if (!shell || !layer || !trigger) return;

    const viewportWidth = document.documentElement.clientWidth;
    const safeViewportPadding = 24;
    const shellRect = shell.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const panelLeft = Math.max(shellRect.left, safeViewportPadding);
    const panelRight = Math.min(
      shellRect.right,
      viewportWidth - safeViewportPadding,
    );
    const panelWidth = Math.max(0, panelRight - panelLeft);
    const calculatedAnchor =
      triggerRect.left + triggerRect.width / 2 - panelLeft;
    const anchorX = Math.min(
      Math.max(40, panelWidth - 40),
      Math.max(40, calculatedAnchor),
    );

    layer.style.setProperty("--menu-panel-left", `${panelLeft}px`);
    layer.style.setProperty("--menu-panel-width", `${panelWidth}px`);
    layer.style.setProperty("--menu-anchor-x", `${anchorX}px`);
  }, []);

  useEffect(() => {
    setMobileLayerMounted(true);
  }, []);

  useEffect(() => {
    if (entranceStartedRef.current) return;

    if (reducedMotion) {
      revealHeader(false);
      return;
    }

    const alreadySeen =
      document.documentElement.dataset.headerEntrance === "seen" ||
      (() => {
        try {
          return (
            window.sessionStorage.getItem(HEADER_ENTRANCE_STORAGE_KEY) === "seen"
          );
        } catch {
          return false;
        }
      })();

    if (alreadySeen) {
      revealHeader(false);
      return;
    }

    if (transitionPhase === "opening") {
      revealHeader(true);
      return;
    }

    const introIsBlocking = Boolean(
      document.documentElement.dataset.siteAccessHandoff,
    );
    if (introIsBlocking || transitionPhase !== "idle") return;

    const frame = window.requestAnimationFrame(() => revealHeader(true));
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, revealHeader, transitionPhase]);

  useEffect(() => {
    openMenuRef.current = null;
    desktopMenuStateRef.current = "closed";
    restoreDesktopFocusRef.current = false;
    focusDesktopPanelOnOpenRef.current = false;
    if (desktopHoverOpenTimerRef.current !== null) {
      window.clearTimeout(desktopHoverOpenTimerRef.current);
      desktopHoverOpenTimerRef.current = null;
    }
    if (desktopHoverCloseTimerRef.current !== null) {
      window.clearTimeout(desktopHoverCloseTimerRef.current);
      desktopHoverCloseTimerRef.current = null;
    }
    if (desktopOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopOpenFrameRef.current);
      desktopOpenFrameRef.current = null;
    }
    if (desktopFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopFocusFrameRef.current);
      desktopFocusFrameRef.current = null;
    }
    setOpenMenu(null);
    setDesktopMenuState("closed");
    setMobileOpen(false);
    setScrollHidden(false);
    mobileHistoryEntryRef.current = false;
  }, [pathname]);

  useEffect(() => {
    lastScrollYRef.current = Math.max(0, window.scrollY);

    function syncHeaderVisibility() {
      scrollFrameRef.current = null;
      const nextScrollY = Math.max(0, window.scrollY);
      const delta = nextScrollY - lastScrollYRef.current;
      const headerOwnsFocus = Boolean(
        headerRef.current?.contains(document.activeElement),
      );

      if (
        nextScrollY <= 40 ||
        delta < -6 ||
        mobileOpen ||
        Boolean(openMenu) ||
        headerOwnsFocus
      ) {
        setScrollHidden(false);
      } else if (delta > 8 && nextScrollY > 136) {
        setScrollHidden(true);
      }

      lastScrollYRef.current = nextScrollY;
    }

    function handleScroll() {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(
        syncHeaderVisibility,
      );
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [mobileOpen, openMenu]);

  useEffect(
    () => () => {
      if (desktopHoverOpenTimerRef.current !== null) {
        window.clearTimeout(desktopHoverOpenTimerRef.current);
      }
      if (desktopHoverCloseTimerRef.current !== null) {
        window.clearTimeout(desktopHoverCloseTimerRef.current);
      }
      if (desktopSwitchFrameRef.current !== null) {
        window.cancelAnimationFrame(desktopSwitchFrameRef.current);
      }
      if (desktopOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(desktopOpenFrameRef.current);
      }
      if (desktopFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(desktopFocusFrameRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    if (!openMenu) return;
    updateDesktopMenuGeometry(openMenu);

    if (desktopMenuStateRef.current !== "closed") return;
    if (desktopOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopOpenFrameRef.current);
    }

    desktopOpenFrameRef.current = window.requestAnimationFrame(() => {
      desktopOpenFrameRef.current = null;
      if (openMenuRef.current !== openMenu) return;
      setDesktopMenuPhase("opening");
    });
  }, [openMenu, setDesktopMenuPhase, updateDesktopMenuGeometry]);

  useEffect(() => {
    if (
      !openMenu ||
      desktopMenuState === "closed" ||
      !focusDesktopPanelOnOpenRef.current
    ) {
      return;
    }

    desktopFocusFrameRef.current = window.requestAnimationFrame(() => {
      desktopFocusFrameRef.current = null;
      if (openMenuRef.current !== openMenu) return;
      const firstLink =
        desktopPanelRef.current?.querySelector<HTMLElement>("a[href]");
      if (!firstLink) return;
      focusDesktopPanelOnOpenRef.current = false;
      firstLink.focus();
    });

    return () => {
      if (desktopFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(desktopFocusFrameRef.current);
        desktopFocusFrameRef.current = null;
      }
    };
  }, [desktopMenuState, openMenu]);

  useEffect(() => {
    if (!openMenu) return;

    function handleGeometryChange() {
      const currentMenu = openMenuRef.current;
      if (currentMenu) updateDesktopMenuGeometry(currentMenu);
    }

    window.addEventListener("resize", handleGeometryChange);
    const observer = new ResizeObserver(handleGeometryChange);
    if (headerShellRef.current) observer.observe(headerShellRef.current);

    return () => {
      window.removeEventListener("resize", handleGeometryChange);
      observer.disconnect();
    };
  }, [openMenu, updateDesktopMenuGeometry]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!openMenu) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (desktopPanelRef.current?.contains(target)) return;
      if (target.closest("[data-header-menu-trigger]")) return;
      closeDesktopMenu(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (mobileOpen) {
        event.preventDefault();
        closeMobileNav();
        return;
      }

      if (openMenu) {
        event.preventDefault();
        closeDesktopMenu(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  useEffect(() => {
    function handlePopState() {
      if (!mobileHistoryEntryRef.current) return;
      mobileHistoryEntryRef.current = false;
      setMobileOpen(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const mobileToggle = mobileToggleRef.current;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      mobileCloseRef.current?.focus();
    });

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(mobilePanelRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      /*
       * Kada se mobilna navigacija zatvara zato što otvara pretragu, fokus
       * pripada polju za unos. Bez ove zastavice bi ovaj `requestAnimationFrame`
       * pukao kadar kasnije i vratio fokus na hamburger — korisnik bi ostao sa
       * otvorenim panelom u koji ne može da kuca.
       */
      if (!mobileHistoryEntryRef.current && !handoffFocusRef.current) {
        window.requestAnimationFrame(() => mobileToggle?.focus());
      }
      handoffFocusRef.current = false;
    };
  }, [mobileOpen]);

  function setTriggerRef(key: HeaderMenuKey, node: HTMLButtonElement | null) {
    triggerRefs.current[key] = node;
  }

  function clearDesktopHoverOpenTimer() {
    if (desktopHoverOpenTimerRef.current === null) return;
    window.clearTimeout(desktopHoverOpenTimerRef.current);
    desktopHoverOpenTimerRef.current = null;
  }

  function clearDesktopHoverCloseTimer() {
    if (desktopHoverCloseTimerRef.current === null) return;
    window.clearTimeout(desktopHoverCloseTimerRef.current);
    desktopHoverCloseTimerRef.current = null;
  }

  function canUseDesktopHover() {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function finishDesktopMenuSwitch() {
    if (desktopSwitchFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopSwitchFrameRef.current);
    }
    desktopSwitchFrameRef.current = window.requestAnimationFrame(() => {
      desktopSwitchFrameRef.current = null;
      setDesktopMenuSwitching(false);
    });
  }

  function finishDesktopMenuClose() {
    const closingMenu = openMenuRef.current;
    const shouldRestoreFocus = restoreDesktopFocusRef.current;
    restoreDesktopFocusRef.current = false;
    openMenuRef.current = null;
    setDesktopMenuPhase("closed");
    setOpenMenu(null);
    setDesktopMenuSwitching(false);

    if (shouldRestoreFocus && closingMenu) {
      window.requestAnimationFrame(() => triggerRefs.current[closingMenu]?.focus());
    }
  }

  function handleDesktopMenuTransitionEnd(
    event: ReactTransitionEvent<HTMLDivElement>,
  ) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (desktopMenuStateRef.current === "opening") {
      const mainSurfaceFinished =
        target.dataset.menuSurface === "true" &&
        event.propertyName.includes("clip-path");
      const mainSequenceFinished =
        target.dataset.menuOpenSequenceEnd === "true" &&
        event.propertyName === "transform";
      const supportSurfaceFinished =
        target.dataset.supportSurface === "true" &&
        event.propertyName === "opacity";

      if (
        mainSurfaceFinished ||
        mainSequenceFinished ||
        supportSurfaceFinished
      ) {
        setDesktopMenuPhase("open");
      }
      return;
    }

    if (
      desktopMenuStateRef.current === "closing" &&
      ((target.dataset.menuSequenceEnd === "true" &&
        event.propertyName === "transform") ||
        (target.dataset.supportSurface === "true" &&
          event.propertyName === "opacity"))
    ) {
      finishDesktopMenuClose();
    }
  }

  function closeDesktopMenu(restoreFocus: boolean) {
    clearDesktopHoverOpenTimer();
    clearDesktopHoverCloseTimer();
    if (!openMenuRef.current) return;
    restoreDesktopFocusRef.current ||= restoreFocus;

    if (reducedMotion || desktopMenuStateRef.current === "closed") {
      finishDesktopMenuClose();
      return;
    }
    if (desktopMenuStateRef.current === "closing") return;

    setDesktopMenuPhase("closing");
    setDesktopMenuSwitching(false);
  }

  function openDesktopMenu(menu: HeaderMenuKey, focusFirstLink = false) {
    const currentMenu = openMenuRef.current;
    const currentState = desktopMenuStateRef.current;
    restoreDesktopFocusRef.current = false;

    openMenuRef.current = menu;
    setOpenMenu(menu);
    setMobileOpen(false);
    focusDesktopPanelOnOpenRef.current = focusFirstLink;

    if (
      focusFirstLink &&
      currentMenu === menu &&
      desktopPanelRef.current
    ) {
      focusDesktopPanelOnOpenRef.current = false;
      desktopPanelRef.current
        .querySelector<HTMLElement>("a[href]")
        ?.focus();
    }

    if (!currentMenu) {
      setDesktopMenuPhase(reducedMotion ? "open" : "closed");
    } else if (currentState === "closing") {
      setDesktopMenuPhase("opening");
    }

  }

  function toggleDesktopMenu(menu: HeaderMenuKey) {
    clearDesktopHoverOpenTimer();
    clearDesktopHoverCloseTimer();
    if (
      openMenuRef.current === menu &&
      desktopMenuStateRef.current !== "closing"
    ) {
      closeDesktopMenu(false);
      return;
    }
    openDesktopMenu(menu);
  }

  function handleDesktopHoverEnter(menu: HeaderMenuKey) {
    if (!canUseDesktopHover()) return;
    clearDesktopHoverCloseTimer();

    if (openMenuRef.current) {
      clearDesktopHoverOpenTimer();
      if (desktopMenuStateRef.current === "closing") {
        if (openMenuRef.current !== menu) {
          setDesktopMenuSwitching(true);
          openMenuRef.current = menu;
          setOpenMenu(menu);
          finishDesktopMenuSwitch();
        }
        restoreDesktopFocusRef.current = false;
        setDesktopMenuPhase("opening");
        return;
      }
      if (openMenuRef.current !== menu) {
        setDesktopMenuSwitching(true);
        openDesktopMenu(menu);
        finishDesktopMenuSwitch();
      }
      return;
    }

    clearDesktopHoverOpenTimer();
    desktopHoverOpenTimerRef.current = window.setTimeout(() => {
      desktopHoverOpenTimerRef.current = null;
      openDesktopMenu(menu);
    }, DESKTOP_HOVER_OPEN_DELAY_MS);
  }

  function handleDesktopHoverLeave() {
    if (!canUseDesktopHover()) return;
    clearDesktopHoverOpenTimer();
    clearDesktopHoverCloseTimer();
    if (!openMenuRef.current) return;

    desktopHoverCloseTimerRef.current = window.setTimeout(() => {
      desktopHoverCloseTimerRef.current = null;
      const activeElement = document.activeElement;
      const activeTrigger = openMenuRef.current
        ? triggerRefs.current[openMenuRef.current]
        : null;
      if (
        activeElement === activeTrigger ||
        (activeElement instanceof Node &&
          desktopPanelRef.current?.contains(activeElement))
      ) {
        return;
      }
      closeDesktopMenu(false);
    }, DESKTOP_HOVER_CLOSE_DELAY_MS);
  }

  function keepDesktopHoverOpen() {
    if (!canUseDesktopHover()) return;
    clearDesktopHoverCloseTimer();
    if (
      openMenuRef.current &&
      desktopMenuStateRef.current === "closing"
    ) {
      restoreDesktopFocusRef.current = false;
      setDesktopMenuPhase("opening");
    }
  }

  function handleDesktopPanelLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canUseDesktopHover()) return;
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Element &&
      relatedTarget.closest("[data-header-hover-zone]")
    ) {
      return;
    }
    handleDesktopHoverLeave();
  }

  function handleTriggerKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    menu: HeaderMenuKey,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openDesktopMenu(menu, true);
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = DESKTOP_MENU_KEYS.indexOf(menu);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + DESKTOP_MENU_KEYS.length) %
      DESKTOP_MENU_KEYS.length;
    triggerRefs.current[DESKTOP_MENU_KEYS[nextIndex]]?.focus();
  }

  function openMobileNav() {
    closeDesktopMenu(false);
    if (!mobileHistoryEntryRef.current) {
      window.history.pushState(
        { ...window.history.state, carsystemMobileMenu: true },
        "",
        window.location.href,
      );
      mobileHistoryEntryRef.current = true;
    }
    setMobileOpen(true);
  }

  function closeMobileNav() {
    if (mobileHistoryEntryRef.current) {
      mobileHistoryEntryRef.current = false;
      setMobileOpen(false);
      window.history.back();
      return;
    }
    setMobileOpen(false);
  }

  function closeMobileForNavigation() {
    mobileHistoryEntryRef.current = false;
    setMobileOpen(false);
  }

  function toggleMobileSection(section: HeaderMenuKey) {
    setMobileSection((current) => (current === section ? null : section));
  }

  return (
    <header
      ref={headerRef}
      className={styles.header}
      data-entrance-state={entranceState}
      data-menu-switching={desktopMenuSwitching || undefined}
      data-scroll-hidden={scrollHidden || undefined}
    >
      <div ref={headerShellRef} className={styles.shell}>
        <Link
          href="/"
          className={styles.brandMark}
          aria-label="Carsystem početna"
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={() => closeDesktopMenu(false)}
        >
          <span className={styles.brandSymbol}>
            <img
              src="/brands/carsystem.svg"
              alt=""
              width="595"
              height="595"
              className={styles.brandMarkLogo}
              decoding="async"
            />
          </span>
          {/* Identitet firme uz logotip; ranije kicker u hero zaglavlju. */}
          <span className={styles.brandLabel}>Carsystem i R-M</span>
        </Link>

        <nav aria-label="Glavna navigacija" className={styles.desktopNav}>
          <ul className={styles.desktopNavList}>
            <HeaderDisclosure
              menuKey="proizvodi"
              label="Proizvodi"
              panelId={productPanelId}
              active={productActive}
              open={
                openMenu === "proizvodi" &&
                desktopMenuState !== "closed" &&
                desktopMenuState !== "closing"
              }
              renderPanel={openMenu === "proizvodi"}
              setTriggerRef={setTriggerRef}
              onKeyDown={handleTriggerKeyDown}
              onToggle={toggleDesktopMenu}
              onHoverEnter={handleDesktopHoverEnter}
              onHoverLeave={handleDesktopHoverLeave}
            >
              <MegaMenuFrame
                id={productPanelId}
                label="Proizvodi"
                title="Kategorije proizvoda"
                description="Direktan pristup materijalima, opremi i priboru za profesionalni refinish proces."
                state={desktopMenuState}
                layerRef={desktopLayerRef}
                panelRef={desktopPanelRef}
                onTransitionEnd={handleDesktopMenuTransitionEnd}
                onClose={() => closeDesktopMenu(true)}
                onHoverEnter={keepDesktopHoverOpen}
                onHoverLeave={handleDesktopPanelLeave}
              >
                <ProductCategoryGrid
                  categories={PRODUCT_CATEGORIES}
                  onNavigate={() => closeDesktopMenu(false)}
                />
                <div className={styles.panelFooter}>
                  <Button
                    href="/katalog"
                    className={styles.catalogCta}
                    onClick={() => closeDesktopMenu(false)}
                  >
                    Pogledajte ceo katalog
                    <ArrowIcon />
                  </Button>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    data-cursor="button"
                    onClick={() => {
                      closeDesktopMenu(false);
                      openSearch(searchTriggerRef.current);
                    }}
                  >
                    <SearchIcon />
                    Pretražite proizvode
                  </button>
                </div>
              </MegaMenuFrame>
            </HeaderDisclosure>

            <HeaderDisclosure
              menuKey="brendovi"
              label="Brendovi"
              panelId={brandPanelId}
              active={brandActive}
              open={
                openMenu === "brendovi" &&
                desktopMenuState !== "closed" &&
                desktopMenuState !== "closing"
              }
              renderPanel={openMenu === "brendovi"}
              setTriggerRef={setTriggerRef}
              onKeyDown={handleTriggerKeyDown}
              onToggle={toggleDesktopMenu}
              onHoverEnter={handleDesktopHoverEnter}
              onHoverLeave={handleDesktopHoverLeave}
            >
              <MegaMenuFrame
                id={brandPanelId}
                label="Brendovi"
                eyebrow="Aktivni program"
                title="Brendovi u Carsystem ekosistemu"
                description="Direktan pristup postojećim brand stranicama, povezanim programima i proizvodima."
                state={desktopMenuState}
                layerRef={desktopLayerRef}
                panelRef={desktopPanelRef}
                onTransitionEnd={handleDesktopMenuTransitionEnd}
                onClose={() => closeDesktopMenu(true)}
                onHoverEnter={keepDesktopHoverOpen}
                onHoverLeave={handleDesktopPanelLeave}
              >
                <ul className={styles.brandGrid} aria-label="Brendovi">
                  {BRAND_LINKS.map((brand) => (
                    <li key={brand.href}>
                      <BrandMenuLink
                        brand={brand}
                        active={isMenuLinkActive(brand.href, pathname)}
                        onNavigate={() => closeDesktopMenu(false)}
                      />
                    </li>
                  ))}
                </ul>
                <div className={styles.panelFooter}>
                  <Link href="/brendovi" onClick={() => closeDesktopMenu(false)}>
                    Pogledajte sve brendove
                    <ArrowIcon />
                  </Link>
                </div>
              </MegaMenuFrame>
            </HeaderDisclosure>

            <HeaderDisclosure
              menuKey="sistemi"
              label="Sistemi i programi"
              panelId={systemPanelId}
              active={systemActive}
              open={
                openMenu === "sistemi" &&
                desktopMenuState !== "closed" &&
                desktopMenuState !== "closing"
              }
              renderPanel={openMenu === "sistemi"}
              setTriggerRef={setTriggerRef}
              onKeyDown={handleTriggerKeyDown}
              onToggle={toggleDesktopMenu}
              onHoverEnter={handleDesktopHoverEnter}
              onHoverLeave={handleDesktopHoverLeave}
            >
              <MegaMenuFrame
                id={systemPanelId}
                label="Sistemi i programi"
                eyebrow="Strukturiran izbor"
                title="Programi, proces i stručna podrška"
                description="Javno dostupne programske celine i stvarni putevi ka podršci."
                state={desktopMenuState}
                layerRef={desktopLayerRef}
                panelRef={desktopPanelRef}
                onTransitionEnd={handleDesktopMenuTransitionEnd}
                onClose={() => closeDesktopMenu(true)}
                onHoverEnter={keepDesktopHoverOpen}
                onHoverLeave={handleDesktopPanelLeave}
              >
                <div className={styles.systemGrid}>
                  {SYSTEM_GROUPS.map((group, groupIndex) => (
                    <section
                      className={styles.systemGroup}
                      key={group.title}
                      aria-labelledby={`${systemPanelId}-group-${groupIndex}`}
                    >
                      <h3 id={`${systemPanelId}-group-${groupIndex}`}>{group.title}</h3>
                      <ul>
                        {group.links.map((link) => (
                          <li key={`${group.title}-${link.href}-${link.title}`}>
                            <SystemMenuLink
                              link={link}
                              active={isMenuLinkActive(link.href, pathname)}
                              onNavigate={() => closeDesktopMenu(false)}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                <div className={styles.panelFooter}>
                  <Link href="/program" onClick={() => closeDesktopMenu(false)}>
                    Pogledajte sve programe
                    <ArrowIcon />
                  </Link>
                </div>
              </MegaMenuFrame>
            </HeaderDisclosure>

            <li className={styles.navItem}>
              <Link
                href="/prodavnice"
                className={styles.navLink}
                aria-current={storeActive ? "page" : undefined}
                data-active={storeActive || undefined}
                onClick={() => closeDesktopMenu(false)}
              >
                Prodavnice
              </Link>
            </li>

            <li className={styles.navItem}>
              <Link
                href="/katalozi"
                className={styles.navLink}
                aria-current={katalozActive ? "page" : undefined}
                data-active={katalozActive || undefined}
                onClick={() => closeDesktopMenu(false)}
              >
                Katalozi
              </Link>
            </li>

            <HeaderDisclosure
              menuKey="podrska"
              label="Podrška"
              panelId={supportPanelId}
              active={supportActive}
              open={
                openMenu === "podrska" &&
                desktopMenuState !== "closed" &&
                desktopMenuState !== "closing"
              }
              renderPanel={openMenu === "podrska"}
              setTriggerRef={setTriggerRef}
              onKeyDown={handleTriggerKeyDown}
              onToggle={toggleDesktopMenu}
              onHoverEnter={handleDesktopHoverEnter}
              onHoverLeave={handleDesktopHoverLeave}
              compact
            >
              <SupportMenu
                id={supportPanelId}
                state={desktopMenuState}
                layerRef={desktopLayerRef}
                panelRef={desktopPanelRef}
                pathname={pathname}
                onTransitionEnd={handleDesktopMenuTransitionEnd}
                onClose={() => closeDesktopMenu(true)}
                onNavigate={() => closeDesktopMenu(false)}
                onHoverEnter={keepDesktopHoverOpen}
                onHoverLeave={handleDesktopPanelLeave}
              />
            </HeaderDisclosure>
          </ul>
        </nav>

        <div className={styles.actions}>
          <button
            ref={searchTriggerRef}
            type="button"
            className={styles.iconAction}
            aria-label="Pretražite proizvode"
            aria-haspopup="dialog"
            title="Pretražite proizvode (Cmd/Ctrl + K)"
            data-cursor="button"
            onClick={() => {
              closeDesktopMenu(false);
              openSearch(searchTriggerRef.current);
            }}
          >
            <SearchIcon />
          </button>
          <span className={styles.themeSlot}>
            <ThemeToggle />
          </span>
          <CustomerAccountMenu />
          <Link
            href="/kontakt"
            className={cx(
              styles.contactCta,
              "cs-magnetic-cta cs-theme-wipe-card",
            )}
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
            onClick={() => closeDesktopMenu(false)}
          >
            <span>Kontakt</span>
          </Link>
          <button
            ref={mobileToggleRef}
            type="button"
            className={styles.mobileToggle}
            aria-label={mobileOpen ? "Zatvori meni" : "Otvori meni"}
            aria-controls={mobilePanelId}
            aria-expanded={mobileOpen}
            onClick={mobileOpen ? closeMobileNav : openMobileNav}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      {mobileLayerMounted && mobileOpen && createPortal(
        <div className={styles.mobileLayer}>
          <button
            type="button"
            className={styles.mobileScrim}
            aria-label="Zatvori meni"
            tabIndex={-1}
            onClick={closeMobileNav}
          />
          <section
            ref={mobilePanelRef}
            id={mobilePanelId}
            className={styles.mobilePanel}
            role="dialog"
            aria-modal="true"
            aria-label="Glavni meni"
          >
            <div className={styles.mobilePanelHeader}>
              <Link
                href="/"
                replace
                className={styles.mobilePanelBrand}
                onClick={closeMobileForNavigation}
              >
                <span className={styles.mobilePanelLogo}>
                  <img
                    src="/brands/carsystem.svg"
                    alt=""
                    width="595"
                    height="595"
                    decoding="async"
                  />
                </span>
              </Link>
              <button
                ref={mobileCloseRef}
                type="button"
                className={styles.mobileClose}
                aria-label="Zatvori meni"
                onClick={closeMobileNav}
              >
                <span />
                <span />
              </button>
            </div>

            <nav className={styles.mobileScrollArea} aria-label="Mobilna navigacija">
              <p className={styles.mobileKicker}>Navigacija</p>
              <ul className={styles.mobileSectionList}>
                <li>
                  <MobileAccordion
                    id={mobileProductId}
                    label="Proizvodi"
                    active={productActive}
                    open={mobileSection === "proizvodi"}
                    onToggle={() => toggleMobileSection("proizvodi")}
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <MobileMenuLink
                        key={category.slug}
                        href={category.href}
                        label={category.label}
                        active={isMenuLinkActive(category.href, pathname)}
                        onNavigate={closeMobileForNavigation}
                      />
                    ))}
                  </MobileAccordion>
                </li>
                <li>
                  <MobileAccordion
                    id={mobileBrandId}
                    label="Brendovi"
                    active={brandActive}
                    open={mobileSection === "brendovi"}
                    onToggle={() => toggleMobileSection("brendovi")}
                  >
                    <MobileMenuLink
                      href="/brendovi"
                      label="Svi brendovi"
                      active={pathname === "/brendovi"}
                      onNavigate={closeMobileForNavigation}
                    />
                    {BRAND_LINKS.map((link) => (
                      <MobileMenuLink
                        key={link.href}
                        href={link.href}
                        label={link.title}
                        active={isMenuLinkActive(link.href, pathname)}
                        onNavigate={closeMobileForNavigation}
                      />
                    ))}
                  </MobileAccordion>
                </li>
                <li>
                  <MobileAccordion
                    id={mobileSystemId}
                    label="Sistemi i programi"
                    active={systemActive}
                    open={mobileSection === "sistemi"}
                    onToggle={() => toggleMobileSection("sistemi")}
                  >
                    <MobileMenuLink
                      href="/program"
                      label="Svi programi"
                      active={pathname === "/program"}
                      onNavigate={closeMobileForNavigation}
                    />
                    {SYSTEM_GROUPS.flatMap((group) => group.links).map((link) => (
                      <MobileMenuLink
                        key={`${link.href}-${link.title}`}
                        href={link.href}
                        label={link.title}
                        active={isMenuLinkActive(link.href, pathname)}
                        onNavigate={closeMobileForNavigation}
                      />
                    ))}
                  </MobileAccordion>
                </li>
                <MobileMenuLink
                  href="/prodavnice"
                  label="Prodavnice"
                  active={storeActive}
                  primary
                  onNavigate={closeMobileForNavigation}
                />
                <MobileMenuLink
                  href="/katalozi"
                  label="Katalozi"
                  active={katalozActive}
                  primary
                  onNavigate={closeMobileForNavigation}
                />
                <MobileMenuLink
                  href="/kontakt?tema=tehnicka-podrska"
                  label="Podrška"
                  active={supportActive}
                  primary
                  onNavigate={closeMobileForNavigation}
                />
              </ul>
            </nav>

            <div className={styles.mobileActions}>
              <button
                type="button"
                className={styles.mobileSearch}
                aria-haspopup="dialog"
                onClick={() => {
                  handoffFocusRef.current = true;
                  closeMobileNav();
                  openSearch(mobileToggleRef.current);
                }}
              >
                <SearchIcon />
                Pretražite proizvode
              </button>
              <CustomerAccountMenu variant="mobile" onNavigate={closeMobileForNavigation} />
              <Link
                href="/kontakt"
                replace
                className={styles.mobileContact}
                onClick={closeMobileForNavigation}
              >
                Kontakt
                <ArrowIcon />
              </Link>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </header>
  );
}

function HeaderDisclosure({
  menuKey,
  label,
  panelId,
  active,
  open,
  renderPanel,
  setTriggerRef,
  onKeyDown,
  onToggle,
  onHoverEnter,
  onHoverLeave,
  compact = false,
  children,
}: {
  menuKey: HeaderMenuKey;
  label: string;
  panelId: string;
  active: boolean;
  open: boolean;
  renderPanel: boolean;
  setTriggerRef: (key: HeaderMenuKey, node: HTMLButtonElement | null) => void;
  onKeyDown: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    menu: HeaderMenuKey,
  ) => void;
  onToggle: (menu: HeaderMenuKey) => void;
  onHoverEnter: (menu: HeaderMenuKey) => void;
  onHoverLeave: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cx(styles.navItem, compact && styles.compactNavItem)}
      data-open={open || undefined}
      onPointerEnter={() => onHoverEnter(menuKey)}
      onPointerLeave={onHoverLeave}
    >
      <button
        ref={(node) => setTriggerRef(menuKey, node)}
        id={`${panelId}-trigger`}
        type="button"
        className={styles.navTrigger}
        aria-expanded={open}
        aria-controls={panelId}
        data-active={active || undefined}
        data-header-menu-trigger
        data-header-hover-zone
        onClick={() => onToggle(menuKey)}
        onKeyDown={(event) => onKeyDown(event, menuKey)}
      >
        <span>{label}</span>
        <ChevronIcon />
      </button>
      <span className={styles.navHoverBridge} data-header-hover-zone aria-hidden="true" />
      {renderPanel ? children : null}
    </li>
  );
}

function MegaMenuFrame({
  id,
  label,
  eyebrow,
  title,
  description,
  state,
  layerRef,
  panelRef,
  onTransitionEnd,
  onClose,
  onHoverEnter,
  onHoverLeave,
  children,
}: {
  id: string;
  label: string;
  eyebrow?: string;
  title: string;
  description: string;
  state: DesktopMenuState;
  layerRef: React.RefObject<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  onTransitionEnd: (event: ReactTransitionEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onHoverEnter: () => void;
  onHoverLeave: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={layerRef}
      className={styles.megaLayer}
      data-state={state}
      onTransitionEnd={onTransitionEnd}
    >
      <button
        type="button"
        className={styles.megaBackdrop}
        aria-label={`Zatvori ${label.toLowerCase()} meni`}
        tabIndex={-1}
        onClick={onClose}
      />
      <div className={styles.menuRevealRail} aria-hidden="true">
        <span className={styles.menuRailLeft} />
        <span className={styles.menuRailRight} />
        <span className={styles.menuAnchorDot} data-menu-anchor-dot="true" />
        <span
          className={styles.menuOpenSequenceSentinel}
          data-menu-open-sequence-end="true"
        />
        <span
          className={styles.menuSequenceSentinel}
          data-menu-sequence-end="true"
        />
      </div>
      <div
        ref={panelRef}
        id={id}
        className={styles.megaPanel}
        data-menu-surface="true"
        aria-labelledby={`${id}-trigger`}
        onPointerEnter={onHoverEnter}
        onPointerLeave={onHoverLeave}
      >
        <div className={styles.panelHeading}>
          <div data-has-eyebrow={eyebrow ? true : undefined}>
            {eyebrow ? <p>{eyebrow}</p> : null}
            <h2>{title}</h2>
            <span>{description}</span>
          </div>
          <button
            type="button"
            className={styles.panelClose}
            aria-label={`Zatvori ${label.toLowerCase()} meni`}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className={styles.panelContent} data-menu-content="true">
          {children}
        </div>
      </div>
    </div>
  );
}

function SupportMenu({
  id,
  state,
  layerRef,
  panelRef,
  pathname,
  onTransitionEnd,
  onClose,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
}: {
  id: string;
  state: DesktopMenuState;
  layerRef: React.RefObject<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  pathname: string;
  onTransitionEnd: (event: ReactTransitionEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onNavigate: () => void;
  onHoverEnter: () => void;
  onHoverLeave: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      ref={layerRef}
      className={styles.megaLayer}
      data-state={state}
      onTransitionEnd={onTransitionEnd}
    >
      <button
        type="button"
        className={styles.megaBackdrop}
        aria-label="Zatvori podrška meni"
        tabIndex={-1}
        onClick={onClose}
      />
      <span
        className={styles.menuSequenceSentinel}
        data-menu-sequence-end="true"
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        id={id}
        className={styles.supportPanel}
        data-support-surface="true"
        aria-labelledby={`${id}-trigger`}
        onPointerEnter={onHoverEnter}
        onPointerLeave={onHoverLeave}
      >
        <div className={styles.supportHeading}>
          <div>
            <p>Stručni tim</p>
            <h2>Kako možemo da pomognemo?</h2>
          </div>
          <button
            type="button"
            className={styles.panelClose}
            aria-label="Zatvori podrška meni"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <ul className={styles.supportLinks}>
          {SUPPORT_LINKS.map((link) => (
            <li key={`${link.href}-${link.title}`}>
              <SystemMenuLink
                link={link}
                active={isMenuLinkActive(link.href, pathname)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BrandMenuLink({
  brand,
  active,
  onNavigate,
}: {
  brand: NavigationLink;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={brand.href}
      className={styles.brandLink}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      onClick={onNavigate}
    >
      <span className={styles.brandLogoFrame}>
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={`${brand.title} logo`}
            width={126}
            height={58}
            className={styles.brandLogo}
          />
        ) : (
          <strong>{brand.title}</strong>
        )}
      </span>
      <span className={styles.brandLinkCopy}>
        <strong>{brand.title}</strong>
        <span>{brand.description}</span>
      </span>
    </Link>
  );
}

function SystemMenuLink({
  link,
  active,
  onNavigate,
}: {
  link: NavigationLink;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      className={styles.systemLink}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      onClick={onNavigate}
    >
      {link.icon ? (
        <span className={styles.systemLinkIcon}>
          <TechnicalIcon name={link.icon} />
        </span>
      ) : (
        <span className={styles.systemIndex} aria-hidden="true" />
      )}
      <span className={styles.menuLinkCopy}>
        <strong>{link.title}</strong>
        <span>{link.description}</span>
      </span>
      <ArrowIcon />
    </Link>
  );
}

function MobileAccordion({
  id,
  label,
  active,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.mobileGroup} data-active={active || undefined}>
      <button
        type="button"
        className={styles.mobileGroupTrigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className={styles.mobileGroupIcon} aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
      <div
        id={id}
        className={styles.mobileGroupBody}
        data-open={open || undefined}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <ul>{children}</ul>
      </div>
    </section>
  );
}

function MobileMenuLink({
  href,
  label,
  active,
  primary = false,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  primary?: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        replace
        className={cx(styles.mobileLink, primary && styles.mobilePrimaryLink)}
        aria-current={active ? "page" : undefined}
        data-active={active || undefined}
        onClick={onNavigate}
      >
        <span>{label}</span>
        <ArrowIcon />
      </Link>
    </li>
  );
}

function TechnicalIcon({ name }: { name: HeaderIconName }) {
  if (name === "prepare") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M7 22.5 20.5 9l4 4L11 26.5H7v-4Z" />
        <path d="m18 11.5 4 4M5 27h22" />
        <path d="M8.5 9.5h6M9.5 6.5h8" />
      </svg>
    );
  }
  if (name === "primer") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M10 8.5h12l2 18H8l2-18Z" />
        <path d="M11 8.5V5.5h10v3M12 15h8M12.5 19h7" />
        <path d="M15 11.5h2" />
      </svg>
    );
  }
  if (name === "paint") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M7 22h9l6-6-7-7-6 6v7Z" />
        <path d="m14.5 9.5 3-3 8 8-3 3M6 25.5h12" />
        <path d="M10 18h5" />
      </svg>
    );
  }
  if (name === "clearcoat") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M16 5.5 25 10v6c0 5.5-3.8 9-9 11-5.2-2-9-5.5-9-11v-6l9-4.5Z" />
        <path d="m12 16 2.6 2.6L20.5 13" />
      </svg>
    );
  }
  if (name === "polish") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <circle cx="15.5" cy="17" r="7.5" />
        <path d="M21 11.5 25.5 7M23.5 7h2v2M8.5 24 6 26.5M5.5 23.5l3 3" />
        <path d="m13 17 1.7 1.8L19 14.5" />
      </svg>
    );
  }
  if (name === "support") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M8 15.5a8 8 0 0 1 16 0v6" />
        <path d="M8 15.5H6.5v6H10v-6H8ZM24 15.5h1.5v6H22v-6h2Z" />
        <path d="M22 24.5h-4" />
      </svg>
    );
  }
  if (name === "documents") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M9 5.5h9l5 5v16H9v-21Z" />
        <path d="M18 5.5v5h5M12.5 16h7M12.5 20h7" />
      </svg>
    );
  }
  if (name === "contact") {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
        <path d="M6.5 8.5h19v15h-19v-15Z" />
        <path d="m7 10 9 7 9-7" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none">
      <rect x="6.5" y="6.5" width="7" height="7" />
      <rect x="18.5" y="6.5" width="7" height="7" />
      <rect x="6.5" y="18.5" width="7" height="7" />
      <rect x="18.5" y="18.5" width="7" height="7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className={styles.chevron}
      aria-hidden="true"
      viewBox="0 0 12 8"
      fill="none"
    >
      <path d="M1.5 1.75 6 6.25l4.5-4.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className={styles.searchIcon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="10.8" cy="10.8" r="5.8" />
      <path d="m15.2 15.2 4.3 4.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className={styles.arrowIcon}
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
    >
      <path d="M3.5 9h10M10 5.5 13.5 9 10 12.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className={styles.closeIcon}
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
    >
      <path d="m4 4 10 10M14 4 4 14" />
    </svg>
  );
}
