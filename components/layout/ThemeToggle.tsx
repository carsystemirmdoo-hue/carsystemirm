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
      className="cs-interactive-surface inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-muted"
      data-cursor="button"
      data-motion-surface
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
    </button>
  );
}
