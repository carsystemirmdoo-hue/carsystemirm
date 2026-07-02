"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PageTransitionOverlay,
  type PageTransitionPhase,
  type PageTransitionVariant,
} from "@/components/motion/PageTransitionOverlay";
import { PigmentCursor } from "@/components/motion/PigmentCursor";
import {
  motionSurfaceSelector,
  resetLocalPointerVars,
  setLocalPointerVars,
} from "@/components/motion/useLocalPointerVars";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isSkippableHref(href: string) {
  return (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("sms:")
  );
}

function getVariant(currentPath: string, nextPath: string): PageTransitionVariant {
  if (currentPath === "/" && nextPath.startsWith("/katalog")) return "paint";
  if (
    nextPath.startsWith("/proizvodi/") &&
    (currentPath.startsWith("/katalog") ||
      currentPath.startsWith("/program") ||
      currentPath.startsWith("/brendovi"))
  ) {
    return "gloss";
  }
  if (currentPath.startsWith("/proizvodi/") && !nextPath.startsWith("/proizvodi/")) {
    return "blur";
  }
  return "glossveil";
}

function getNavigationTiming({
  reduceMotion,
  isTouchWidth,
  variant,
}: {
  reduceMotion: boolean;
  isTouchWidth: boolean;
  variant: PageTransitionVariant;
}) {
  if (reduceMotion) return { delay: 0, fallbackDuration: 260 };
  if (isTouchWidth) return { delay: 56, fallbackDuration: 500 };
  if (variant === "paint") return { delay: 190, fallbackDuration: 700 };
  if (variant === "glossveil") return { delay: 130, fallbackDuration: 560 };

  return { delay: 170, fallbackDuration: 620 };
}

function setProductHoverDirection(productCard: HTMLElement) {
  const directions = ["top", "bottom", "side"] as const;
  const hoverCount = Number(productCard.dataset.hoverCount ?? "0");

  productCard.dataset.hoverDirection = directions[hoverCount % directions.length];
  productCard.dataset.hoverCount = String(hoverCount + 1);
  productCard.dataset.productHoverActive = "true";
}

export function MotionSystem({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  const activeSurfaceRef = useRef<HTMLElement | null>(null);
  const activeProductCardRef = useRef<HTMLElement | null>(null);
  const pendingNavigationRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<PageTransitionPhase>("idle");
  const [variant, setVariant] = useState<PageTransitionVariant>("glossveil");
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    pathRef.current = pathname;

    if (!pendingNavigationRef.current) return;

    pendingNavigationRef.current = false;
    setPhase("revealing");

    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    const revealTimer = window.setTimeout(() => {
      setPhase("idle");
    }, 230);

    return () => window.clearTimeout(revealTimer);
  }, [pathname]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;

      const target = event.target instanceof Element ? event.target : null;
      const nextSurface = target?.closest<HTMLElement>(motionSurfaceSelector) ?? null;
      const nextProductCard =
        target?.closest<HTMLElement>("[data-product-card-motion]") ?? null;

      if (activeSurfaceRef.current && activeSurfaceRef.current !== nextSurface) {
        resetLocalPointerVars(activeSurfaceRef.current);
      }

      if (activeProductCardRef.current && activeProductCardRef.current !== nextProductCard) {
        activeProductCardRef.current.dataset.productHoverActive = "false";
      }

      if (nextProductCard && activeProductCardRef.current !== nextProductCard) {
        setProductHoverDirection(nextProductCard);
      }

      activeSurfaceRef.current = nextSurface;
      activeProductCardRef.current = nextProductCard;

      if (nextSurface) {
        setLocalPointerVars(nextSurface, event);
      }
    }

    function handlePointerOut(event: PointerEvent) {
      const surface = activeSurfaceRef.current;
      if (!surface) return;
      if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) return;

      resetLocalPointerVars(surface);
      activeSurfaceRef.current = null;
      if (activeProductCardRef.current) {
        activeProductCardRef.current.dataset.productHoverActive = "false";
        activeProductCardRef.current = null;
      }
    }

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerout", handlePointerOut);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || isSkippableHref(rawHref)) return;

      const nextUrl = new URL(rawHref, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const sameDocument =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        Boolean(nextUrl.hash);
      if (sameDocument) return;

      const destination = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (destination === `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`) return;

      event.preventDefault();

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const isTouchWidth = window.matchMedia("(hover: none), (pointer: coarse)").matches;
      const nextVariant = getVariant(pathRef.current, nextUrl.pathname);
      const { delay, fallbackDuration } = getNavigationTiming({
        reduceMotion,
        isTouchWidth,
        variant: nextVariant,
      });

      pendingNavigationRef.current = true;
      setVariant(nextVariant);
      setOrigin({
        x: Number.isFinite(event.clientX) ? event.clientX : window.innerWidth / 2,
        y: Number.isFinite(event.clientY) ? event.clientY : window.innerHeight / 2,
      });
      setPhase("leaving");

      window.setTimeout(() => {
        router.push(destination);
      }, delay);

      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
      }

      fallbackTimerRef.current = window.setTimeout(() => {
        pendingNavigationRef.current = false;
        setPhase("idle");
      }, fallbackDuration);
    }

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [router]);

  return (
    <>
      {children}
      <PigmentCursor />
      <PageTransitionOverlay origin={origin} phase={phase} variant={variant} />
    </>
  );
}
