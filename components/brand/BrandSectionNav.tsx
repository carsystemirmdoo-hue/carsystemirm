"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./BrandSectionNav.module.css";

export type BrandSectionNavItem = {
  href: string;
  label: string;
  sectionId: string;
};

type BrandSectionNavProps = {
  ariaLabel: string;
  items: BrandSectionNavItem[];
  pageSelector?: string;
};

export function BrandSectionNav({
  ariaLabel,
  items,
  pageSelector = "[data-brand-page]",
}: BrandSectionNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const activeIdRef = useRef(items[0]?.sectionId ?? "");
  const [activeId, setActiveId] = useState(activeIdRef.current);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const nav = navRef.current;
    const page = nav?.closest<HTMLElement>(pageSelector);
    const header = document.querySelector<HTMLElement>("body > div header, body > header, header");

    if (!nav || !page) return;

    let animationFrame = 0;
    let headerHidden = header?.hasAttribute("data-scroll-hidden") ?? false;

    const setOffsets = () => {
      const headerHeight =
        header && !headerHidden ? Math.ceil(header.getBoundingClientRect().height) : 0;
      const navHeight = Math.ceil(nav.getBoundingClientRect().height);

      page.style.setProperty("--brand-section-header-offset", `${headerHeight}px`);
      page.style.setProperty("--brand-section-nav-height", `${navHeight}px`);
    };

    const syncActiveSection = () => {
      animationFrame = 0;
      setOffsets();

      const headerOffset = Number.parseFloat(
        page.style.getPropertyValue("--brand-section-header-offset"),
      );
      const navHeight = nav.getBoundingClientRect().height;
      const probe = Math.max(
        (Number.isFinite(headerOffset) ? headerOffset : 0) + navHeight + 32,
        window.innerHeight * 0.32,
      );
      let nextId = items[0]?.sectionId ?? "";
      let closestPassedTop = Number.NEGATIVE_INFINITY;

      for (const item of items) {
        const section = document.getElementById(item.sectionId);
        const sectionTop = section?.getBoundingClientRect().top;

        if (
          sectionTop !== undefined &&
          sectionTop <= probe &&
          sectionTop > closestPassedTop
        ) {
          closestPassedTop = sectionTop;
          nextId = item.sectionId;
        }
      }

      if (nextId && nextId !== activeIdRef.current) {
        activeIdRef.current = nextId;
        setActiveId(nextId);
      }
    };

    const scheduleSync = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(syncActiveSection);
      }
    };

    // Offset se upisuje odmah, ne tek u sledećem animation frame-u. Bez ovoga
    // sticky nav ostaje na `top: 0` i završi iza globalnog headera ako se efekat
    // ponovo pokrene (nestabilan `items` niz) pre nego što rAF stigne da odradi.
    setOffsets();

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(nav);
    if (header) resizeObserver.observe(header);

    const headerObserver = header
      ? new MutationObserver(() => {
          headerHidden = header.hasAttribute("data-scroll-hidden");
          scheduleSync();
        })
      : null;

    headerObserver?.observe(header!, {
      attributes: true,
      attributeFilter: ["data-scroll-hidden"],
    });

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);
    scheduleSync();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      resizeObserver.disconnect();
      headerObserver?.disconnect();
      // Izmerene vrednosti se namerno ne brišu: čišćenje na svaku promenu
      // zavisnosti vratilo bi nav na `0px` fallback i gurnulo ga pod header.
    };
  }, [items, pageSelector]);

  useEffect(() => {
    const activeLink = linkRefs.current.get(activeId);
    const rail = railRef.current;
    if (
      !activeLink ||
      !rail ||
      window.matchMedia("(min-width: 64rem)").matches
    ) {
      return;
    }

    rail.scrollTo({
      behavior: reducedMotion ? "auto" : "smooth",
      left:
        activeLink.offsetLeft -
        (rail.clientWidth - activeLink.offsetWidth) / 2,
    });
  }, [activeId, reducedMotion]);

  return (
    <nav ref={navRef} className={styles.nav} aria-label={ariaLabel}>
      <div ref={railRef} className={styles.rail}>
        {items.map((item) => (
          <Link
            ref={(node) => {
              if (node) linkRefs.current.set(item.sectionId, node);
              else linkRefs.current.delete(item.sectionId);
            }}
            href={item.href}
            aria-current={activeId === item.sectionId ? "location" : undefined}
            data-active={activeId === item.sectionId || undefined}
            key={item.sectionId}
            onClick={() => {
              activeIdRef.current = item.sectionId;
              setActiveId(item.sectionId);
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
