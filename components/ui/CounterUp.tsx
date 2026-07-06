"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";

export function CounterUp({
  durationMs = 760,
  value,
}: {
  durationMs?: number;
  value: number;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const frameRef = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasStartedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      hasStartedRef.current = true;
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    function start() {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

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

    if (!("IntersectionObserver" in window)) {
      start();
      return () => window.cancelAnimationFrame(frameRef.current);
    }

    const rect = node.getBoundingClientRect();
    const isAlreadyVisible =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0;

    if (isAlreadyVisible) {
      start();
      return () => window.cancelAnimationFrame(frameRef.current);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        start();
      },
      { threshold: 0.35 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [durationMs, prefersReducedMotion, value]);

  return (
    <span ref={ref} suppressHydrationWarning>
      {displayValue.toLocaleString("sr-Latn")}
    </span>
  );
}
