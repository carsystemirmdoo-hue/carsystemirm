"use client";

import { useRef } from "react";
import type { InquiryTopic } from "@/components/contact/ContactForm";
import styles from "./ContactPage.module.css";

const inquiryRows: {
  help: string;
  title: string;
  topic: InquiryTopic;
}[] = [
  {
    topic: "Proizvod",
    title: "Proizvod / materijal",
    help: "Treba mi konkretan proizvod, šifra ili brend iz programa.",
  },
  {
    topic: "Tehnička podrška",
    title: "Tehnička podrška",
    help: "Pitanje o programu, procesu ili fazi rada.",
  },
  {
    topic: "Najbliža prodavnica",
    title: "Najbliža prodavnica",
    help: "Tražim prodajno mesto ili servis u mojoj blizini.",
  },
  {
    topic: "B2B saradnja",
    title: "B2B saradnja",
    help: "Predlog poslovne saradnje, distribucije ili otvaranja prodajnog mesta.",
  },
  {
    topic: "Opšti upit",
    title: "Opšti upit",
    help: "Poruka koju tim treba da prosledi pravoj osobi.",
  },
];

export function InquiryTypeCards({
  activeTopic,
  onSelect,
}: {
  activeTopic: InquiryTopic;
  onSelect: (topic: InquiryTopic) => void;
}) {
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = inquiryRows.length - 1;
    let nextIndex = -1;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    }

    if (nextIndex === -1) return;
    event.preventDefault();
    onSelect(inquiryRows[nextIndex].topic);
    rowRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={styles.intentRows} role="tablist" aria-label="Razlog kontakta">
      {inquiryRows.map((row, index) => {
        const isActive = activeTopic === row.topic;

        return (
          <button
            aria-selected={isActive}
            aria-controls="contact-context-panel"
            className={`${styles.intentRow} ${
              isActive ? styles.intentRowActive : ""
            } cs-interactive-surface`}
            data-motion-surface
            id={`contact-intent-${index}`}
            key={row.topic}
            onClick={() => onSelect(row.topic)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              rowRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            type="button"
          >
            <span className={styles.intentBar} aria-hidden="true" />
            <span className={styles.intentIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={styles.intentCopy}>
              <strong>{row.title}</strong>
              <small>{row.help}</small>
            </span>
            <span className={styles.intentChevron} aria-hidden="true">
              →
            </span>
          </button>
        );
      })}
    </div>
  );
}
