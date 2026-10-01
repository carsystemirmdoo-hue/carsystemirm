"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InquiryTypeCards } from "@/components/contact/InquiryTypeCards";
import { StoreLocatorTeaser } from "@/components/contact/StoreLocatorTeaser";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type { CompanyContact } from "@/lib/company-contact";
import type { PartnerStore } from "@/lib/partner-stores";
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

type TopicAction = {
  href: string;
  label: string;
  external?: boolean;
};

const topicConfig: Record<
  InquiryTopic,
  {
    contextLabel: string;
    contextPlaceholder: string;
    formHeading: string;
    formHelp: string;
    panelHeading: string;
    panelHelp: string;
    primaryAction?: TopicAction;
    title: string;
  }
> = {
  Proizvod: {
    contextLabel: "Proizvod / brend / program",
    contextPlaceholder: "Na primer: R-M DIAMONT bazna boja",
    formHeading: "Recite nam koji proizvod tražite",
    formHelp: "Navedite naziv, šifru, brend ili program ako ga znate.",
    panelHeading: "Upit za proizvod ili materijal",
    panelHelp:
      "Ako znate naziv ili šifru, upit stiže direktno do prave osobe. Katalog može da pomogne oko programa.",
    primaryAction: { href: "/katalog", label: "Otvorite katalog" },
    title: "PROIZVOD / MATERIJAL",
  },
  "Najbliža prodavnica": {
    contextLabel: "Grad ili region",
    contextPlaceholder: "Na primer: Novi Sad",
    formHeading: "Pronađimo Vam najbližu lokaciju",
    formHelp: "Grad pomaže timu da preporuči odgovarajuće prodajno mesto.",
    panelHeading: "Najbrži put je mapa prodavnica",
    panelHelp:
      "Lokator prikazuje partnersku mrežu sa pretragom i filterima. Upit ostaje opcija ako želite preporuku tima.",
    primaryAction: { href: "/prodavnice", label: "Otvorite mapu prodavnica" },
    title: "PRODAJNO MESTO",
  },
  "Tehnička podrška": {
    contextLabel: "Program / proces",
    contextPlaceholder: "Na primer: podloga, lak, poliranje",
    formHeading: "Pitanje o Carsystem / R-M programu",
    formHelp: "Opišite o kom programu ili fazi rada je reč.",
    panelHeading: "Tehnička podrška za proces",
    panelHelp:
      "Opišite fazu rada i materijal — tim usmerava pitanje ka tehničkoj podršci programa.",
    title: "PITANJE O PROGRAMU",
  },
  "B2B saradnja": {
    contextLabel: "Firma / vrsta saradnje",
    contextPlaceholder: "Na primer: prodajno mesto, servis, distribucija",
    formHeading: "Predložite poslovnu saradnju",
    formHelp: "Recite nam nešto o firmi, gradu i vrsti saradnje.",
    panelHeading: "Razgovor o poslovnoj saradnji",
    panelHelp:
      "Partnerska mreža je primarni kanal programa. Navedite grad i vrstu saradnje koju predlažete.",
    title: "POSLOVNA SARADNJA",
  },
  "Opšti upit": {
    contextLabel: "Kratak kontekst",
    contextPlaceholder: "Opciono",
    formHeading: "Opišite Vaš upit",
    formHelp: "Tim će proslediti poruku odgovarajućoj osobi.",
    panelHeading: "Poruka za Carsystem tim",
    panelHelp: "Za sve što ne spada u prethodne teme — poruka stiže do centrale.",
    title: "DRUGO",
  },
};

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export function ContactForm({
  contact,
  initialValues,
  stores,
}: {
  contact: CompanyContact;
  initialValues: ContactInitialValues;
  stores: PartnerStore[];
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
  const [submitState, setSubmitState] = useState<"idle" | "error" | "submitting" | "blocked">(
    "idle",
  );
  const [triedSubmit, setTriedSubmit] = useState(false);
  const copy = topicConfig[topic];
  const nameInvalid = triedSubmit && !fullName.trim();
  const emailInvalid = triedSubmit && Boolean(email.trim()) && !isValidEmail(email);
  const contactInvalid = triedSubmit && !phone.trim() && !email.trim();

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
    setTriedSubmit(true);

    const hasValidationError =
      !fullName.trim() || (!phone.trim() && !email.trim()) || (email.trim() && !isValidEmail(email));

    if (hasValidationError) {
      setSubmitState("error");
      setSubmitNotice("Popunite ime i bar jedan kontakt podatak pre pripreme upita.");
      return;
    }

    setSubmitState("submitting");

    const body = [
      `Tema: ${topic}`,
      `Ime i prezime: ${fullName}`,
      company ? `Firma / servis: ${company}` : "",
      phone ? `Telefon: ${phone}` : "",
      email ? `E-pošta: ${email}` : "",
      city ? `Grad: ${city}` : "",
      context ? `${copy.contextLabel}: ${context}` : "",
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    window.setTimeout(() => {
      window.location.href = `${contact.emailHref}?subject=${encodeURIComponent(
        `Upit sa sajta: ${topic}`,
      )}&body=${encodeURIComponent(body)}`;
      setSubmitState("blocked");
      setSubmitNotice(
        "Otvoren je Vaš program za e-poštu sa pripremljenim upitom. Proverite poruku i pošaljite je iz tog programa — sajt je ne šalje automatski.",
      );
    }, 140);
  }

  function handleTopicSelect(nextTopic: InquiryTopic) {
    setTopic(nextTopic);
    setSubmitNotice("");
    setSubmitState("idle");
  }

  return (
    <div className={styles.intentSection}>
      <p className={styles.indexKicker}>01 · Razlog kontakta</p>
      <div className={styles.routerReveal}>
        <InquiryTypeCards activeTopic={topic} onSelect={handleTopicSelect} />
      </div>

      <section
        aria-live="polite"
        className={styles.contextPanel}
        id="contact-context-panel"
        role="tabpanel"
      >
        <div className={styles.contextCopy} key={topic}>
          <p className={styles.sectionKicker}>{copy.title}</p>
          <div className={styles.contextFade}>
            <h2>{copy.panelHeading}</h2>
            <p>{copy.panelHelp}</p>
          </div>
        </div>
        <div className={styles.contextActions}>
          {copy.primaryAction ? (
            <Link
              className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
              data-cursor="button"
              data-motion-surface
              data-motion="theme-wipe"
              href={copy.primaryAction.href}
            >
              <span>{copy.primaryAction.label} →</span>
            </Link>
          ) : contact.phone && contact.phoneHref ? (
            <a
              className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
              data-cursor="button"
              data-motion-surface
              data-motion="theme-wipe"
              href={contact.phoneHref}
            >
              <span>Pozovite {contact.phone}</span>
            </a>
          ) : null}
          <a className={styles.secondaryButton} href="#inquiry-form-title">
            Popunite formu ispod
          </a>
        </div>
      </section>

      <div className={styles.formSection}>
        <section className={styles.formPanel} aria-labelledby="inquiry-form-title">
          <div className={styles.formHeader}>
            <div>
              <p className={styles.sectionKicker}>{copy.title}</p>
              <h2 id="inquiry-form-title">{copy.formHeading}</h2>
              <p>{copy.formHelp}</p>
            </div>
            <span>{submitState === "submitting" ? "Priprema poruke" : "Priprema upita"}</span>
          </div>

          <form className={styles.formGrid} onSubmit={handleSubmit} noValidate>
            <Field label="Ime i prezime" htmlFor="contact-name">
              <input
                autoComplete="name"
                aria-invalid={nameInvalid || undefined}
                aria-describedby={nameInvalid ? "contact-name-error" : undefined}
                id="contact-name"
                onChange={(event) => setFullName(event.target.value)}
                type="text"
                value={fullName}
              />
              {nameInvalid ? (
                <small className={styles.fieldError} id="contact-name-error">
                  Unesite ime i prezime.
                </small>
              ) : null}
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
                aria-invalid={contactInvalid || undefined}
                id="contact-phone"
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                value={phone}
              />
            </Field>

            <Field label="E-pošta" htmlFor="contact-email">
              <input
                autoComplete="email"
                aria-invalid={emailInvalid || contactInvalid || undefined}
                aria-describedby={
                  emailInvalid
                    ? "contact-email-error"
                    : contactInvalid
                      ? "contact-contact-error"
                      : undefined
                }
                id="contact-email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              {emailInvalid ? (
                <small className={styles.fieldError} id="contact-email-error">
                  Unesite ispravnu adresu e-pošte.
                </small>
              ) : null}
              {contactInvalid ? (
                <small className={styles.fieldError} id="contact-contact-error">
                  Unesite telefon ili e-poštu.
                </small>
              ) : null}
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
              <SearchableCombobox
                ariaLabel="Tema upita"
                emptyMessage="Nema tema koje odgovaraju pretrazi."
                id="contact-topic"
                onChange={(nextTopic) => handleTopicSelect(nextTopic as InquiryTopic)}
                options={topicOptions.map((option) => ({ label: option, value: option }))}
                placeholder="Izaberite temu"
                searchPlaceholder="Pretražite temu"
                sheetTitle="Izaberite temu upita"
                value={topic}
              />
            </Field>

            <Field
              className={styles.fullSpan}
              label={copy.contextLabel}
              htmlFor="contact-context"
            >
              <input
                id="contact-context"
                onChange={(event) => setContext(event.target.value)}
                placeholder={copy.contextPlaceholder}
                type="text"
                value={context}
              />
            </Field>

            <Field className={styles.fullSpan} label="Poruka" htmlFor="contact-message">
              <textarea
                id="contact-message"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Opišite šta Vam je potrebno, koji grad pokrivate i kada je najbolje da Vas tim kontaktira."
                rows={7}
                value={message}
              />
            </Field>

            <div className={styles.formFooter}>
              <button
                className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
                disabled={submitState === "submitting"}
                type="submit"
                data-cursor="button"
                data-motion-surface
                data-motion="theme-wipe"
              >
                <span>{submitState === "submitting" ? "Priprema..." : "Pripremite upit"}</span>
              </button>
              <p>
                Upit se otvara kao pripremljena poruka u Vašem programu za e-poštu,
                odakle je šaljete.
              </p>
            </div>

            {submitNotice ? (
              <div
                className={styles.submitNotice}
                data-state={submitState}
                data-submit-notice
                role="status"
              >
                {submitNotice}
              </div>
            ) : null}
          </form>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.reviewPanel} aria-label="Pregled upita">
            <p className={styles.sectionKicker}>Pregled upita</p>
            <dl>
              {reviewRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <StoreLocatorTeaser stores={stores} />
        </aside>
      </div>
    </div>
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
    <div className={`${styles.field} ${className ?? ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
