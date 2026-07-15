"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./CarsystemHomePage.module.css";

const homeSectionItems = [
  { id: "pocetna", label: "Idi na početnu sekciju" },
  { id: "program", label: "Idi na proces" },
  { id: "prodavnice-mreza", label: "Idi na prodavnice" },
  { id: "brendovi", label: "Idi na programe proizvoda" },
  { id: "zavrsni-poziv", label: "Idi na završni poziv" },
] as const;

type HomeSectionId = (typeof homeSectionItems)[number]["id"];

export function HomeSectionRail() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeId, setActiveId] = useState<HomeSectionId>(homeSectionItems[0].id);

  useEffect(() => {
    const sections = homeSectionItems.flatMap((item) => {
      const section = document.getElementById(item.id);
      return section ? [section] : [];
    });
    if (sections.length === 0 || !("IntersectionObserver" in window)) return undefined;

    const intersectingIds = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) intersectingIds.add(entry.target.id);
          else intersectingIds.delete(entry.target.id);
        });

        const viewportCenter = window.innerHeight / 2;
        const closestSection = sections
          .filter((section) => intersectingIds.has(section.id))
          .map((section) => {
            const rect = section.getBoundingClientRect();
            return {
              id: section.id as HomeSectionId,
              distance: Math.abs(rect.top + rect.height / 2 - viewportCenter),
            };
          })
          .sort((left, right) => left.distance - right.distance)[0];

        if (closestSection) setActiveId(closestSection.id);
      },
      { rootMargin: "-42% 0px -48% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function navigateToSection(id: HomeSectionId) {
    const target = document.getElementById(id);
    if (!target) return;

    setActiveId(id);
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <nav className={styles.sectionRail} aria-label="Navigacija kroz početnu stranicu">
      {homeSectionItems.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            type="button"
            key={item.id}
            aria-label={item.label}
            aria-current={isActive ? "location" : undefined}
            data-active={isActive || undefined}
            onClick={() => navigateToSection(item.id)}
          >
            <span aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
