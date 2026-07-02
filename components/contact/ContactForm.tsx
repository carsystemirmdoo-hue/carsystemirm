"use client";

import { useMemo, useState } from "react";
import { InquiryTypeCards } from "@/components/contact/InquiryTypeCards";
import type { CompanyContact } from "@/lib/company-contact";
import styles from "./ContactPage.module.css";

export type InquiryTopic =
  | "Proizvod"
  | "Tehnička podrška"
  | "Najbliža prodavnica"
  | "B2B saradnja"
  | "Opšti upit";

export type ContactInitialValues = {
  city?: string;
  context?: string;
  message?: string;
  topic: InquiryTopic;
};

const topicOptions: InquiryTopic[] = [
  "Proizvod",
  "Tehnička podrška",
  "Najbliža prodavnica",
  "B2B saradnja",
  "Opšti upit",
];

export function ContactForm({
  contact,
  initialValues,
}: {
  contact: CompanyContact;
  initialValues: ContactInitialValues;
}) {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(initialValues.city ?? "");
  const [topic, setTopic] = useState<InquiryTopic>(initialValues.topic);
  const [context, setContext] = useState(initialValues.context ?? "");
  const [message, setMessage] = useState(initialValues.message ?? "");
  const [submitNotice, setSubmitNotice] = useState("");

  const reviewRows = useMemo(
    () => [
      ["Tema", topic],
      ["Grad", city || "Nije unet"],
      ["Kontakt", phone || email || "Nije unet"],
      ["Kontekst", context || "Bez dodatog proizvoda, brenda ili programa"],
    ],
    [city, context, email, phone, topic],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitNotice(
      "Forma je spremna za povezivanje sa email servisom. Do tada, upit možete poslati putem telefona ili emaila.",
    );
  }

  function handleTopicSelect(nextTopic: InquiryTopic) {
    setTopic(nextTopic);
    setSubmitNotice("");
  }

  return (
    <section className={styles.formPanel} aria-labelledby="inquiry-form-title">
      <div className={styles.formHeader}>
        <div>
          <p className={styles.sectionKicker}>Upit</p>
          <h2 id="inquiry-form-title">Detalji za tim Carsystem i R-M</h2>
        </div>
        <span>Priprema upita</span>
      </div>

      <InquiryTypeCards activeTopic={topic} onSelect={handleTopicSelect} />

      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <Field label="Ime i prezime" htmlFor="contact-name">
          <input
            autoComplete="name"
            id="contact-name"
            onChange={(event) => setFullName(event.target.value)}
            required
            type="text"
            value={fullName}
          />
        </Field>

        <Field label="Firma / servis" htmlFor="contact-company">
          <input
            autoComplete="organization"
            id="contact-company"
            onChange={(event) => setCompany(event.target.value)}
            type="text"
            value={company}
          />
        </Field>

        <Field label="Telefon" htmlFor="contact-phone">
          <input
            autoComplete="tel"
            id="contact-phone"
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </Field>

        <Field label="Email" htmlFor="contact-email">
          <input
            autoComplete="email"
            id="contact-email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </Field>

        <Field label="Grad" htmlFor="contact-city">
          <input
            autoComplete="address-level2"
            id="contact-city"
            onChange={(event) => setCity(event.target.value)}
            type="text"
            value={city}
          />
        </Field>

        <Field label="Tema upita" htmlFor="contact-topic">
          <select
            id="contact-topic"
            onChange={(event) => setTopic(event.target.value as InquiryTopic)}
            value={topic}
          >
            {topicOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field
          className={styles.fullSpan}
          label="Proizvod / brend / program"
          htmlFor="contact-context"
        >
          <input
            id="contact-context"
            onChange={(event) => setContext(event.target.value)}
            placeholder="Na primer: R-M DIAMONT bazna boja"
            type="text"
            value={context}
          />
        </Field>

        <Field className={styles.fullSpan} label="Poruka" htmlFor="contact-message">
          <textarea
            id="contact-message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Opišite šta vam je potrebno, koji grad pokrivate i kada je najbolje da vas tim kontaktira."
            rows={7}
            value={message}
          />
        </Field>

        <div className={styles.formFooter}>
          <button className={styles.primaryButton} type="submit">
            Pripremi upit
          </button>
          <p>
            Slanjem se ne šalje email automatski. Direktan kontakt je dostupan
            preko telefona i emaila: {contact.email}.
          </p>
        </div>

        {submitNotice ? (
          <div className={styles.submitNotice} data-submit-notice role="status">
            {submitNotice}
          </div>
        ) : null}
      </form>

      <aside className={styles.reviewPanel} aria-label="Pregled upita">
        <p className={styles.sectionKicker}>Pregled</p>
        <dl>
          {reviewRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </section>
  );
}

function Field({
  children,
  className,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className={`${styles.field} ${className ?? ""}`} htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}
