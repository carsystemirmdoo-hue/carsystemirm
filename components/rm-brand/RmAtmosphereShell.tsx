"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./RmBrandPage.module.css";

type RmPageTheme = "default" | "agilis" | "refinity";

const THEME_PROBE_RATIO = 0.42;

export function RmAtmosphereShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeThemeRef = useRef<RmPageTheme>("default");
  const [activeTheme, setActiveTheme] = useState<RmPageTheme>("default");

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.rmBrandPage = "true";
    delete root.dataset.rmAtmosphere;

    const zones = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[data-rm-atmosphere-zone]") ??
        [],
    );

    let frameId: number | null = null;

    function applyTheme(nextTheme: RmPageTheme) {
      if (activeThemeRef.current === nextTheme) return;
      activeThemeRef.current = nextTheme;
      setActiveTheme(nextTheme);

      if (nextTheme === "default") delete root.dataset.rmAtmosphere;
      else root.dataset.rmAtmosphere = nextTheme;
    }

    function syncTheme() {
      frameId = null;
      const probeY = window.innerHeight * THEME_PROBE_RATIO;
      const activeZone = zones
        .map((zone) => {
          const rect = zone.getBoundingClientRect();
          return {
            theme: zone.dataset.rmAtmosphereZone as RmPageTheme,
            distance: Math.abs(rect.top + rect.height / 2 - probeY),
            isAtProbe: rect.top <= probeY && rect.bottom > probeY,
          };
        })
        .filter((zone) => zone.isAtProbe)
        .sort((a, b) => a.distance - b.distance)[0];

      applyTheme(activeZone?.theme ?? "default");
    }

    function scheduleSync() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(syncTheme);
    }

    syncTheme();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleSync);
    zones.forEach((zone) => resizeObserver?.observe(zone));

    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      resizeObserver?.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      activeThemeRef.current = "default";
      delete root.dataset.rmBrandPage;
      delete root.dataset.rmAtmosphere;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.rmPage}
      data-atmosphere={activeTheme}
    >
      {children}
    </div>
  );
}
