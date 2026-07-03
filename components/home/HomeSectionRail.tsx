"use client";

import { useEffect, useState } from "react";
import styles from "./CarsystemHomePage.module.css";

/**
 * Decorative scroll indicator for the homepage: one bar per top-level
 * section, highlighted while that section crosses the middle of the
 * viewport. Purely visual (aria-hidden, no pointer events) — it never
 * drives navigation or scrolling.
 */
export function HomeSectionRail() {
  const [sectionCount, setSectionCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return undefined;

    const sections = Array.from(main.querySelectorAll<HTMLElement>(":scope > section"));
    if (sections.length === 0) return undefined;

    setSectionCount(sections.length);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = sections.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActiveIndex(index);
        }
      },
      // A section is "active" while it crosses the middle band of the viewport.
      { rootMargin: "-45% 0px -45% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  if (sectionCount === 0) return null;

  return (
    <div className={styles.sectionRail} aria-hidden="true">
      {Array.from({ length: sectionCount }, (_, index) => (
        <span key={index} data-active={index === activeIndex || undefined} />
      ))}
    </div>
  );
}
