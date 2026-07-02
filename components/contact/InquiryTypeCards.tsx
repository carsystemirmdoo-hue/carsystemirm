"use client";

import type { InquiryTopic } from "@/components/contact/ContactForm";
import styles from "./ContactPage.module.css";

const inquiryCards: {
  topic: InquiryTopic;
  title: string;
  body: string;
}[] = [
  {
    topic: "Proizvod",
    title: "Treba vam proizvod?",
    body: "Upit za artikal, program, pakovanje ili dostupnost.",
  },
  {
    topic: "Najbliža prodavnica",
    title: "Tražite najbližu prodavnicu?",
    body: "Unesite grad i tim će vas usmeriti ka partneru.",
  },
  {
    topic: "Tehnička podrška",
    title: "Potrebna vam je tehnička podrška?",
    body: "Pitanja za proces, nijansu, podlogu ili aplikaciju.",
  },
  {
    topic: "B2B saradnja",
    title: "Želite B2B saradnju?",
    body: "Razgovor o partnerskom nalogu i komercijalnim uslovima.",
  },
];

export function InquiryTypeCards({
  activeTopic,
  onSelect,
}: {
  activeTopic: InquiryTopic;
  onSelect: (topic: InquiryTopic) => void;
}) {
  return (
    <div className={styles.inquiryCards} aria-label="Brzi izbor teme upita">
      {inquiryCards.map((card) => (
        <button
          aria-pressed={activeTopic === card.topic}
          className={`${styles.inquiryTypeCard} ${
            activeTopic === card.topic ? styles.inquiryTypeCardActive : ""
          }`}
          key={card.topic}
          onClick={() => onSelect(card.topic)}
          type="button"
        >
          <span>{card.topic}</span>
          <strong>{card.title}</strong>
          <small>{card.body}</small>
        </button>
      ))}
    </div>
  );
}
