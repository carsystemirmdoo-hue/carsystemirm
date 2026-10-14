"use client";

import { useEffect, useState } from "react";
import { useMotionTransition } from "@/components/motion/MotionConfigProvider";

const THEME_STORAGE_KEY = "theme";

function readCurrentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const runThemeTransition = useMotionTransition();

  useEffect(() => {
    setIsDark(readCurrentTheme() === "dark");

    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setIsDark(event.newValue === "dark");
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function applyTheme(next: boolean) {
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage unavailable, theme just won't persist.
    }
  }

  function toggle() {
    const next = !isDark;
    runThemeTransition(() => applyTheme(next));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Uključite svetlu temu" : "Uključite tamnu temu"}
      aria-pressed={isDark}
      className="inline-flex size-10 items-center justify-center rounded-[var(--ds-ctl-radius)] border !border-[var(--ds-c-line-strong)] text-[var(--ds-c-text)] transition-colors hover:bg-[var(--ds-c-surface-2)]"
      data-cursor="button"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.75v2.1M12 19.15v2.1M2.75 12h2.1M19.15 12h2.1M5.46 5.46l1.48 1.48M17.06 17.06l1.48 1.48M5.46 18.54l1.48-1.48M17.06 6.94l1.48-1.48" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.5 14.6A7.75 7.75 0 0 1 9.4 4.5a7.75 7.75 0 1 0 10.1 10.1Z" />
    </svg>
  );
}
