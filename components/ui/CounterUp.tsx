"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";

export function CounterUp({
  delayMs = 0,
  durationMs = 1450,
  suffix = "",
  threshold = 0.45,
  value,
}: {
  delayMs?: number;
  durationMs?: number;
  suffix?: string;
  threshold?: number;
  value: number;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const frameRef = useRef(0);
  const delayRef = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasStartedRef = useRef(false);
  // Server i prvi prikaz nose stvarnu vrednost: bez JavaScripta (ili kad
  // animacija ne krene) brojač ne sme da ostane na nuli.
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      hasStartedRef.current = true;
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;
    if (!hasStartedRef.current) setDisplayValue(0);

    function startCount() {
      const startedAt = performance.now();
      function tick(now: number) {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplayValue(Math.round(value * eased));

        if (progress < 1) {
          frameRef.current = window.requestAnimationFrame(tick);
        }
      }

      frameRef.current = window.requestAnimationFrame(tick);
    }

    function start() {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      delayRef.current = window.setTimeout(startCount, delayMs);
    }

    if (!("IntersectionObserver" in window)) {
      start();
      return () => {
        window.clearTimeout(delayRef.current);
        window.cancelAnimationFrame(frameRef.current);
      };
    }

    const target = node.closest<HTMLElement>("[data-counter-group]") ?? node;
    let visibilityFallbackTimer = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < threshold) return;
        observer.disconnect();
        start();
      },
      { threshold },
    );

    observer.observe(target);

    function checkVisibleFallback() {
      if (hasStartedRef.current) return;

      const rect = target.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
      );
      const area = rect.width * rect.height;
      const visibleRatio = area > 0 ? (visibleWidth * visibleHeight) / area : 0;

      if (visibleRatio >= threshold) {
        observer.disconnect();
        start();
        return;
      }

      visibilityFallbackTimer = window.setTimeout(checkVisibleFallback, 600);
    }

    checkVisibleFallback();

    return () => {
      observer.disconnect();
      window.clearTimeout(visibilityFallbackTimer);
      window.clearTimeout(delayRef.current);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [delayMs, durationMs, prefersReducedMotion, threshold, value]);

  return (
    <span ref={ref} suppressHydrationWarning>
      {displayValue.toLocaleString("sr-Latn")}
      {suffix}
    </span>
  );
}
