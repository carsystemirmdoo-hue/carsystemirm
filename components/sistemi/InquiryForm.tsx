"use client";

import { useId, useState } from "react";
import {
  inquiryBody,
  inquiryMailto,
  inquirySubject,
  isValidEmail,
  type InquiryLine,
} from "@/lib/contact/inquiry-handoff";
import styles from "./Sistemi.styles";

type Status = "idle" | "invalid" | "preparing" | "prepared" | "failed";

/**
 * Upit sa stručne stranice, B2B stranice ili biblioteke. Izbor sa stranice (posao, podloga,
 * vrsta firme, dokument) ulazi u poruku. Poruka se otvara u programu za e-poštu posetioca;
 * sajt je ne šalje sam, pa ni ne prikazuje uspeh slanja.
 */
export function InquiryForm({
  topic,
  context,
  email,
  emailHref,
  extraField,
  companyRequired = false,
  messageLabel = "Pitanje ili poruka",
  messagePlaceholder,
  submitLabel = "Pripremite upit",
}: {
  topic: string;
  context: InquiryLine[];
  email: string;
  emailHref: string;
  extraField?: { label: string; placeholder?: string };
  companyRequired?: boolean;
  messageLabel?: string;
  messagePlaceholder?: string;
  submitLabel?: string;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [mail, setMail] = useState("");
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);
  const tried = status === "invalid";

  const nameError = tried && !name.trim() ? "Unesite ime i prezime." : "";
  const companyError = tried && companyRequired && !company.trim() ? "Unesite naziv firme." : "";
  const contactError = tried && !phone.trim() && !mail.trim() ? "Unesite telefon ili e-poštu." : "";
  const mailError = tried && mail.trim() && !isValidEmail(mail) ? "Adresa e-pošte nije ispravna." : "";
  const messageError = tried && !message.trim() ? "Napišite kratko pitanje ili poruku." : "";

  const lines: InquiryLine[] = [
    ...context,
    ...(extraField ? ([[extraField.label, extra]] as InquiryLine[]) : []),
    ["Ime i prezime", name],
    ["Firma", company],
    ["Grad", city],
    ["Telefon", phone],
    ["E-pošta", mail],
  ];
  const body = inquiryBody(topic, lines, message);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid =
      !name.trim() ||
      (companyRequired && !company.trim()) ||
      (!phone.trim() && !mail.trim()) ||
      Boolean(mail.trim() && !isValidEmail(mail)) ||
      !message.trim();
    if (invalid) {
      setStatus("invalid");
      return;
    }
    setStatus("preparing");
    setCopied(false);
    window.setTimeout(() => {
      try {
        window.location.href = inquiryMailto(emailHref, topic, body);
        setStatus("prepared");
      } catch {
        setStatus("failed");
      }
    }, 120);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(`${inquirySubject(topic)}\n\n${body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const errorIds = (name: string, error: string) => (error ? `${id}-${name}-greska` : undefined);

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {context.length ? (
        <div className={styles.contextBox}>
          <strong>Uz upit se šalje:</strong>
          {context.map(([label, value]) => (
            <span key={label}>
              {label}: {value}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          Ime i prezime
          <input
            aria-describedby={errorIds("ime", nameError)}
            aria-invalid={nameError ? true : undefined}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          {nameError ? (
            <span className={styles.fieldError} id={`${id}-ime-greska`}>
              {nameError}
            </span>
          ) : null}
        </label>
        <label className={styles.field}>
          {companyRequired ? "Naziv firme" : "Firma ili radionica (nije obavezno)"}
          <input
            aria-describedby={errorIds("firma", companyError)}
            aria-invalid={companyError ? true : undefined}
            autoComplete="organization"
            onChange={(event) => setCompany(event.target.value)}
            value={company}
          />
          {companyError ? (
            <span className={styles.fieldError} id={`${id}-firma-greska`}>
              {companyError}
            </span>
          ) : null}
        </label>
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          Telefon
          <input
            aria-describedby={errorIds("kontakt", contactError)}
            aria-invalid={contactError ? true : undefined}
            autoComplete="tel"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </label>
        <label className={styles.field}>
          E-pošta
          <input
            aria-describedby={[errorIds("kontakt", contactError), errorIds("posta", mailError)].filter(Boolean).join(" ") || undefined}
            aria-invalid={contactError || mailError ? true : undefined}
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setMail(event.target.value)}
            type="email"
            value={mail}
          />
          {mailError ? (
            <span className={styles.fieldError} id={`${id}-posta-greska`}>
              {mailError}
            </span>
          ) : null}
        </label>
      </div>
      {contactError ? (
        <span className={styles.fieldError} id={`${id}-kontakt-greska`}>
          {contactError}
        </span>
      ) : null}

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          Grad
          <input autoComplete="address-level2" onChange={(event) => setCity(event.target.value)} value={city} />
        </label>
        {extraField ? (
          <label className={styles.field}>
            {extraField.label}
            <input onChange={(event) => setExtra(event.target.value)} placeholder={extraField.placeholder} value={extra} />
          </label>
        ) : null}
      </div>

      <label className={styles.field}>
        {messageLabel}
        <textarea
          aria-describedby={errorIds("poruka", messageError)}
          aria-invalid={messageError ? true : undefined}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={messagePlaceholder}
          value={message}
        />
        {messageError ? (
          <span className={styles.fieldError} id={`${id}-poruka-greska`}>
            {messageError}
          </span>
        ) : null}
      </label>

      <div className={styles.actions}>
        <button className={`${styles.primaryButton} cs-cta`} data-cta-fill="red" disabled={status === "preparing"} type="submit">
          <span>{status === "preparing" ? "Pripremamo poruku…" : submitLabel}</span>
        </button>
      </div>

      <div aria-live="polite" role="status">
        {status === "invalid" ? (
          <div className={styles.notice} data-tone="error">
            <p>Proverite označena polja. Upit nije pripremljen.</p>
          </div>
        ) : null}
        {status === "prepared" || status === "failed" ? (
          <div className={styles.notice} data-tone={status === "failed" ? "error" : "info"}>
            {status === "prepared" ? (
              <p>
                <strong>Poruka još nije poslata.</strong> U Vašem programu za e-poštu otvorena je pripremljena poruka za{" "}
                {email}. Proverite je i pošaljite iz tog programa.
              </p>
            ) : (
              <p>
                <strong>Program za e-poštu nije otvoren.</strong> Poruka nije poslata.
              </p>
            )}
            <p>
              Ako se program nije otvorio, kopirajte poruku i pošaljite je na <strong>{email}</strong>.
            </p>
            <pre className={styles.messagePreview}>{`${inquirySubject(topic)}\n\n${body}`}</pre>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} onClick={copyMessage} type="button">
                {copied ? "Poruka je kopirana" : "Kopirajte poruku"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
