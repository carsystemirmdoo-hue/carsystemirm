import Link from "next/link";
import { ContactForm, type ContactInitialValues } from "@/components/contact/ContactForm";
import { ContactInfoCard } from "@/components/contact/ContactInfoCard";
import { Footer } from "@/components/layout/Footer";
import type { CompanyContact } from "@/lib/company-contact";
import styles from "./ContactPage.module.css";

export function ContactPage({
  contact,
  initialValues,
}: {
  contact: CompanyContact;
  initialValues: ContactInitialValues;
}) {
  const quickCards = [
    {
      label: "Telefon",
      value: contact.phone,
      href: contact.phoneHref,
    },
    {
      label: "Email",
      value: contact.email,
      href: contact.emailHref,
    },
    {
      label: "Lokacija",
      value: contact.locationLabel,
      href: "#contact-info",
    },
    {
      label: "Partnerska mreža",
      value: "Prodavnice u Srbiji",
      href: "/prodavnice",
    },
  ];

  return (
    <div className={styles.pageShell}>
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="contact-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Kontakt i upiti</p>
            <h1 id="contact-title" className={styles.title}>
              Pošaljite upit
            </h1>
            <p className={styles.subtitle}>
              Kontaktirajte Carsystem i R-M tim za proizvode, tehničku podršku,
              dostupnost i najbližu prodavnicu.
            </p>
          </div>

          <div className={styles.quickGrid} aria-label="Brzi kontakt">
            {quickCards.map((card) => (
              <Link className={styles.quickCard} href={card.href} key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.contentGrid} aria-label="Kontakt forma i podrška">
          <ContactForm contact={contact} initialValues={initialValues} />

          <aside className={styles.sideColumn}>
            <ContactInfoCard contact={contact} />
            <section className={styles.noteCard} aria-labelledby="contact-routing-title">
              <p className={styles.sectionKicker}>Rutiranje upita</p>
              <h2 id="contact-routing-title">Jedan upit, pravi smer.</h2>
              <p>
                Navedite grad, proizvod ili program. Tim može da usmeri upit ka
                tehničkoj podršci, centrali u Inđiji ili najbližoj prodavnici.
              </p>
            </section>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
}
