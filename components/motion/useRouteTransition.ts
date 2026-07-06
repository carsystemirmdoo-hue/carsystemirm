"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteTransitionPhase } from "@/components/motion/RouteTransitionOverlay";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";

const COVER_DURATION = 420;
const HOLD_DURATION = 80;
const REVEAL_DURATION = 460;
const REDUCED_DURATION = 120;
const ROUTE_FALLBACK_DURATION = 1600;

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

export function useRouteTransition() {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  const pendingNavigationRef = useRef(false);
  const transitioningRef = useRef(false);
  const transitionTokenRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const entryFrameRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<RouteTransitionPhase>("idle");

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== timer);
      callback();
    }, delay);

    timersRef.current.push(timer);
  }, []);

  const completeTransition = useCallback(
    (token: number) => {
      if (transitionTokenRef.current !== token) return;

      pendingNavigationRef.current = false;
      transitioningRef.current = false;
      setPhase("idle");
    },
    [],
  );

  const revealTransition = useCallback(
    (token: number) => {
      if (transitionTokenRef.current !== token) return;

      setPhase("revealing");
      schedule(
        () => completeTransition(token),
        reducedMotionRef.current ? REDUCED_DURATION : REVEAL_DURATION,
      );
    },
    [completeTransition, schedule],
  );

  const startTransition = useCallback(
    (onCovered: () => void, options: { waitForPathChange: boolean }) => {
      clearTimers();

      const token = transitionTokenRef.current + 1;
      transitionTokenRef.current = token;
      transitioningRef.current = true;
      pendingNavigationRef.current = options.waitForPathChange;

      if (reducedMotionRef.current) {
        setPhase("fade");
        onCovered();
        if (!options.waitForPathChange) {
          schedule(() => completeTransition(token), REDUCED_DURATION);
        } else {
          schedule(() => {
            if (!pendingNavigationRef.current) return;
            revealTransition(token);
          }, REDUCED_DURATION + ROUTE_FALLBACK_DURATION);
        }
        return;
      }

      setPhase("covering");
      schedule(() => {
        if (transitionTokenRef.current !== token) return;

        setPhase("covered");
        onCovered();

        if (!options.waitForPathChange) {
          schedule(() => revealTransition(token), HOLD_DURATION);
          return;
        }

        schedule(() => {
          if (!pendingNavigationRef.current) return;
          pendingNavigationRef.current = false;
          revealTransition(token);
        }, ROUTE_FALLBACK_DURATION);
      }, COVER_DURATION);
    },
    [clearTimers, completeTransition, revealTransition, schedule],
  );

  const runThemeTransition = useCallback(
    (swapTheme: () => void) => {
      if (transitioningRef.current) {
        swapTheme();
        return;
      }

      startTransition(swapTheme, { waitForPathChange: false });
    },
    [startTransition],
  );

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (!pendingNavigationRef.current) return;

    const token = transitionTokenRef.current;
    pendingNavigationRef.current = false;
    schedule(
      () => revealTransition(token),
      reducedMotionRef.current ? REDUCED_DURATION : HOLD_DURATION,
    );
  }, [pathname, revealTransition, schedule]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event) || transitioningRef.current) return;

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
      startTransition(
        () => router.push(destination),
        { waitForPathChange: nextUrl.pathname !== currentUrl.pathname },
      );
    }

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [router, startTransition]);

  useEffect(
    () => () => {
      clearTimers();

      if (entryFrameRef.current !== null) {
        window.cancelAnimationFrame(entryFrameRef.current);
        entryFrameRef.current = null;
      }
    },
    [clearTimers],
  );

  return {
    phase,
    reducedMotion,
    runThemeTransition,
  };
}
