"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteTransitionPhase } from "@/components/motion/RouteTransitionOverlay";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import {
  clearSiteAccessHandoff,
  readSiteAccessHandoff,
  SITE_ACCESS_HANDOFF_EVENT,
  SITE_ACCESS_HANDOFF_NAVIGATION_TIMEOUT_MS,
  waitForActiveHomeHero,
} from "@/lib/site-access-handoff";

const COVER_DURATION = 420;
const HOLD_DURATION = 80;
const REVEAL_DURATION = 460;
const VISUAL_EVENT_GRACE = 140;
const ROUTE_FALLBACK_DURATION = 5_500;

type TransitionKind =
  | "boot"
  | "route"
  | "popstate"
  | "theme"
  | "handoff";

type TransitionMachine = {
  expectedRouteKey: string | null;
  focusAfterNavigation: boolean;
  kind: TransitionKind;
  navigation: (() => void) | null;
  phase: RouteTransitionPhase;
  sourceRouteKey: string;
  token: number;
};

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

function getLocationRouteKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function getUrlRouteKey(url: URL) {
  return `${url.pathname}${url.search}`;
}

function prefersReducedMotionNow() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function nextFrames(count: number) {
  return new Promise<void>((resolve) => {
    function advance(remaining: number) {
      window.requestAnimationFrame(() => {
        if (remaining <= 1) {
          resolve();
          return;
        }

        advance(remaining - 1);
      });
    }

    advance(Math.max(1, count));
  });
}

async function waitForImage(image: HTMLImageElement) {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      const finish = () => {
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };

      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
  }

  if (image.complete && image.naturalWidth > 0 && typeof image.decode === "function") {
    await image.decode().catch(() => undefined);
  }
}

async function waitForCriticalRouteAssets() {
  const criticalImages = Array.from(
    document.querySelectorAll<HTMLImageElement>('img[data-route-critical="true"]'),
  );
  const fontsReady =
    "fonts" in document ? document.fonts.ready.then(() => undefined) : Promise.resolve();
  const homeHeroReady =
    window.location.pathname === "/" ? waitForActiveHomeHero() : Promise.resolve();

  await Promise.all([
    fontsReady,
    homeHeroReady,
    ...criticalImages.map((image) => waitForImage(image)),
  ]);
}

function focusRouteLandmark() {
  const landmark = document.querySelector<HTMLElement>("main h1, main");
  if (!landmark) return;

  const hadTabIndex = landmark.hasAttribute("tabindex");
  if (!hadTabIndex) landmark.setAttribute("tabindex", "-1");
  landmark.focus({ preventScroll: true });

  if (!hadTabIndex) {
    landmark.addEventListener(
      "blur",
      () => landmark.removeAttribute("tabindex"),
      { once: true },
    );
  }
}

function syncDocumentPhase(phase: RouteTransitionPhase) {
  if (phase === "idle") {
    delete document.documentElement.dataset.routeTransition;
    document.body.removeAttribute("aria-busy");
    return;
  }

  document.documentElement.dataset.routeTransition = phase;
  document.body.setAttribute("aria-busy", "true");
}

export function useRouteTransition() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  const machineRef = useRef<TransitionMachine>({
    expectedRouteKey: null,
    focusAfterNavigation: false,
    kind: "boot",
    navigation: null,
    phase: "booting",
    sourceRouteKey: "",
    token: 0,
  });
  const lastCommittedRouteRef = useRef("");
  const readinessRequestRef = useRef("");
  const timersRef = useRef<Set<number>>(new Set());
  const [phase, setPhase] = useState<RouteTransitionPhase>("booting");

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);

    timersRef.current.add(timer);
  }, []);

  const commitMachine = useCallback((nextMachine: TransitionMachine) => {
    machineRef.current = nextMachine;
    setPhase(nextMachine.phase);
    syncDocumentPhase(nextMachine.phase);
  }, []);

  const finishOpening = useCallback(
    (token: number) => {
      const current = machineRef.current;
      if (current.token !== token || current.phase !== "opening") return;

      const shouldFocus = current.focusAfterNavigation;
      clearTimers();
      readinessRequestRef.current = "";
      commitMachine({
        expectedRouteKey: null,
        focusAfterNavigation: false,
        kind: current.kind,
        navigation: null,
        phase: "idle",
        sourceRouteKey: getLocationRouteKey(),
        token,
      });

      if (shouldFocus) {
        window.requestAnimationFrame(focusRouteLandmark);
      }
    },
    [clearTimers, commitMachine],
  );

  const beginOpening = useCallback(
    (token: number) => {
      const current = machineRef.current;
      if (
        current.token !== token ||
        current.phase === "idle" ||
        current.phase === "opening"
      ) {
        return;
      }

      clearTimers();
      clearSiteAccessHandoff();
      commitMachine({ ...current, phase: "opening" });

      if (reducedMotionRef.current || prefersReducedMotionNow()) {
        void nextFrames(1).then(() => finishOpening(token));
        return;
      }

      schedule(
        () => finishOpening(token),
        REVEAL_DURATION + VISUAL_EVENT_GRACE,
      );
    },
    [clearTimers, commitMachine, finishOpening, schedule],
  );

  const revealWhenReady = useCallback(
    async (token: number, routeKey: string) => {
      const requestKey = `${token}:${routeKey}`;
      if (readinessRequestRef.current === requestKey) return;
      readinessRequestRef.current = requestKey;

      await waitForCriticalRouteAssets();
      await nextFrames(2);

      const current = machineRef.current;
      if (
        current.token !== token ||
        (current.phase !== "booting" && current.phase !== "navigating")
      ) {
        return;
      }

      beginOpening(token);
    },
    [beginOpening],
  );

  const scheduleRouteFallback = useCallback(
    (token: number, duration = ROUTE_FALLBACK_DURATION) => {
      schedule(() => {
        const current = machineRef.current;
        if (current.token !== token || current.phase === "idle") return;
        beginOpening(token);
      }, duration);
    },
    [beginOpening, schedule],
  );

  const handleCoverComplete = useCallback(() => {
    const current = machineRef.current;
    if (current.phase !== "closing") return;

    commitMachine({ ...current, phase: "covered" });

    if (current.kind === "theme") {
      current.navigation?.();
      schedule(() => beginOpening(current.token), HOLD_DURATION);
      return;
    }

    if (current.kind === "route") {
      commitMachine({ ...current, phase: "navigating" });
      try {
        current.navigation?.();
      } catch {
        beginOpening(current.token);
      }
      return;
    }

    if (current.kind === "handoff") {
      commitMachine({ ...current, phase: "navigating" });
    }
  }, [beginOpening, commitMachine, schedule]);

  const beginClosing = useCallback(
    ({
      expectedRouteKey,
      fallbackDuration,
      focusAfterNavigation,
      kind,
      navigation,
    }: {
      expectedRouteKey: string | null;
      fallbackDuration?: number;
      focusAfterNavigation: boolean;
      kind: "route" | "theme" | "handoff";
      navigation: (() => void) | null;
    }) => {
      clearTimers();
      const token = machineRef.current.token + 1;
      const nextMachine: TransitionMachine = {
        expectedRouteKey,
        focusAfterNavigation,
        kind,
        navigation,
        phase: "closing",
        sourceRouteKey: getLocationRouteKey(),
        token,
      };
      commitMachine(nextMachine);
      scheduleRouteFallback(token, fallbackDuration);

      if (reducedMotionRef.current || prefersReducedMotionNow()) {
        void nextFrames(1).then(handleCoverComplete);
      } else {
        schedule(
          handleCoverComplete,
          COVER_DURATION + VISUAL_EVENT_GRACE,
        );
      }
    },
    [
      clearTimers,
      commitMachine,
      handleCoverComplete,
      schedule,
      scheduleRouteFallback,
    ],
  );

  const runThemeTransition = useCallback(
    (swapTheme: () => void) => {
      if (machineRef.current.phase !== "idle") {
        swapTheme();
        return;
      }

      beginClosing({
        expectedRouteKey: null,
        focusAfterNavigation: false,
        kind: "theme",
        navigation: swapTheme,
      });
    },
    [beginClosing],
  );

  const onRouteCommit = useCallback(
    (routeKey: string) => {
      const previousRouteKey = lastCommittedRouteRef.current;
      lastCommittedRouteRef.current = routeKey;

      const current = machineRef.current;
      if (current.phase !== "navigating") return;
      if (
        routeKey === current.sourceRouteKey &&
        routeKey !== current.expectedRouteKey &&
        routeKey === previousRouteKey
      ) {
        return;
      }

      void revealWhenReady(current.token, routeKey);
    },
    [revealWhenReady],
  );

  const onOpenComplete = useCallback(() => {
    const current = machineRef.current;
    if (current.phase !== "opening") return;
    finishOpening(current.token);
  }, [finishOpening]);

  useEffect(() => {
    function handleSiteAccessHandoff() {
      if (machineRef.current.phase !== "idle") return;

      beginClosing({
        expectedRouteKey: null,
        fallbackDuration: SITE_ACCESS_HANDOFF_NAVIGATION_TIMEOUT_MS,
        focusAfterNavigation: false,
        kind: "handoff",
        navigation: null,
      });
    }

    window.addEventListener(SITE_ACCESS_HANDOFF_EVENT, handleSiteAccessHandoff);

    return () => {
      window.removeEventListener(SITE_ACCESS_HANDOFF_EVENT, handleSiteAccessHandoff);
    };
  }, [beginClosing]);

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

      let nextUrl: URL;
      try {
        nextUrl = new URL(rawHref, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const sameDocument =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        Boolean(nextUrl.hash);
      if (sameDocument) return;

      const destination = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (destination === `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`) return;

      // Dok se nova strana još otkriva, klik se ne guta: navigacija ide uobičajenim
      // putem (bez prelaza). Ranije je preventDefault pre provere faze tiho bacao klik.
      if (machineRef.current.phase === "opening") return;

      event.preventDefault();

      if (machineRef.current.phase !== "idle") return;

      beginClosing({
        expectedRouteKey: getUrlRouteKey(nextUrl),
        focusAfterNavigation: nextUrl.pathname !== currentUrl.pathname,
        kind: "route",
        navigation: () => router.push(destination),
      });
    }

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [beginClosing, router]);

  useEffect(() => {
    function handlePopState() {
      const targetRouteKey = getLocationRouteKey();
      if (targetRouteKey === lastCommittedRouteRef.current) return;

      clearTimers();
      const token = machineRef.current.token + 1;
      const nextMachine: TransitionMachine = {
        expectedRouteKey: targetRouteKey,
        focusAfterNavigation: false,
        kind: "popstate",
        navigation: null,
        phase: "navigating",
        sourceRouteKey: lastCommittedRouteRef.current,
        token,
      };

      /*
       * popstate cannot be delayed cross-browser. Setting the root attribute
       * synchronously guarantees a fully covered screen before the browser can
       * paint the new React tree.
       */
      syncDocumentPhase("navigating");
      commitMachine(nextMachine);
      scheduleRouteFallback(token);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [clearTimers, commitMachine, scheduleRouteFallback]);

  useEffect(() => {
    function blockKeyboardNavigation(event: KeyboardEvent) {
      if (event.key === "Tab" && machineRef.current.phase !== "idle") {
        event.preventDefault();
      }
    }

    document.addEventListener("keydown", blockKeyboardNavigation, {
      capture: true,
    });
    return () => {
      document.removeEventListener("keydown", blockKeyboardNavigation, {
        capture: true,
      });
    };
  }, []);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const routeKey = getLocationRouteKey();
    lastCommittedRouteRef.current = routeKey;
    readSiteAccessHandoff();

    if (document.documentElement.dataset.routeTransition === "fallback") {
      clearTimers();
      commitMachine({
        ...machineRef.current,
        kind: "boot",
        phase: "idle",
        sourceRouteKey: routeKey,
      });
      return;
    }

    syncDocumentPhase("booting");
    clearTimers();
    scheduleRouteFallback(machineRef.current.token);
    void revealWhenReady(machineRef.current.token, routeKey);
  }, [
    clearTimers,
    commitMachine,
    revealWhenReady,
    scheduleRouteFallback,
  ]);

  useEffect(
    () => () => {
      clearTimers();
      delete document.documentElement.dataset.routeTransition;
      document.body.removeAttribute("aria-busy");
    },
    [clearTimers],
  );

  return {
    phase,
    reducedMotion,
    runThemeTransition,
    onCoverComplete: handleCoverComplete,
    onOpenComplete,
    onRouteCommit,
  };
}
