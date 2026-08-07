"use client";

import { type ElementType, type ReactNode, useEffect, useRef } from "react";

/**
 * Panel reveal za Car Fit stranicu.
 *
 * Skriveno stanje se renderuje već na serveru (`data-cf-reveal`), pa nema
 * treperenja pri hidraciji. Bez JavaScripta sadržaj otključava `<noscript>`
 * stil u `CarfitBrandPage`, a `prefers-reduced-motion` gasi efekat u CSS-u.
 */
export function CarfitReveal({
  as: Tag = "div",
  children,
  className,
  delay = 0,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (!("IntersectionObserver" in window)) {
      node.setAttribute("data-cf-reveal", "in");
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.setAttribute("data-cf-reveal", "in");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={className}
      data-cf-reveal=""
      style={delay ? ({ "--cf-reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
