"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import {
  applyEffectiveTheme,
  readThemePreference,
  resolveFrameTheme,
  setFrameTheme,
  THEME_PREFERENCE_EVENT,
  type FrameThemeRequest,
} from "./frameTheme";

/** Sekcija je aktivna kada preseca liniju na 42 % visine ekrana (isto kao R-M atmosfera). */
const PROBE_RATIO = 0.42;
/** Aktivna sekcija ostaje aktivna dok je linija u pojasu ±6 % — bez treperenja na ivici. */
const HOLD_RATIO = 0.06;

/**
 * Jedan kontroler za ceo sajt: istaknute sekcije sa `data-frame-theme`
 * privremeno menjaju temu okvira (header, navigacija brenda, meniji, pozadina).
 * Pri promeni stranice privremena tema se briše pre crtanja nove stranice.
 */
export function FrameThemeController() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    let frameId: number | null = null;
    let active: HTMLElement | null = null;

    function sync() {
      frameId = null;
      const height = window.innerHeight;
      const probe = height * PROBE_RATIO;
      const hold = height * HOLD_RATIO;
      const zones = Array.from(document.querySelectorAll<HTMLElement>("[data-frame-theme]"));

      if (active && zones.includes(active)) {
        const rect = active.getBoundingClientRect();
        if (rect.top <= probe + hold && rect.bottom >= probe - hold && rect.height > 0) {
          apply(active);
          return;
        }
      }

      active =
        zones
          .map((zone) => ({ zone, rect: zone.getBoundingClientRect() }))
          .filter(({ rect }) => rect.height > 0 && rect.top <= probe && rect.bottom > probe)
          .sort((a, b) => a.rect.height - b.rect.height)[0]?.zone ?? null;
      apply(active);
    }

    function apply(zone: HTMLElement | null) {
      const request = zone?.dataset.frameTheme as FrameThemeRequest | undefined;
      setFrameTheme(resolveFrameTheme(request, readThemePreference()));
    }

    function schedule() {
      if (frameId === null) frameId = window.requestAnimationFrame(sync);
    }

    function onPreference() {
      applyEffectiveTheme();
      sync();
    }

    // Nova stranica počinje bez privremene teme; prvi prolaz odmah (direktan link na sekciju).
    setFrameTheme(null);
    sync();
    const late = window.setTimeout(schedule, 400);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener(THEME_PREFERENCE_EVENT, onPreference);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.body);

    return () => {
      window.clearTimeout(late);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("pageshow", schedule);
      window.removeEventListener(THEME_PREFERENCE_EVENT, onPreference);
      resizeObserver?.disconnect();
      setFrameTheme(null);
    };
  }, [pathname]);

  return null;
}
