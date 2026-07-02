import Link from "next/link";
import type { CompanyContact } from "@/lib/company-contact";
import styles from "./ContactPage.module.css";

export function ContactInfoCard({ contact }: { contact: CompanyContact }) {
  return (
    <section className={styles.infoCard} id="contact-info" aria-labelledby="company-card-title">
      <p className={styles.sectionKicker}>Centrala</p>
      <h2 id="company-card-title">{contact.name}</h2>
      <p>{contact.partnerNetworkNote}</p>

      <dl className={styles.infoList}>
        <div>
          <dt>Lokacija</dt>
          <dd>{contact.locationLabel}</dd>
        </div>
        <div>
          <dt>Telefon</dt>
          <dd>
            <a href={contact.phoneHref}>{contact.phone}</a>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            <a href={contact.emailHref}>{contact.email}</a>
          </dd>
        </div>
        <div>
          <dt>Radno vreme</dt>
          <dd>{contact.workingHours}</dd>
        </div>
      </dl>

      <div className={styles.infoActions}>
        <a className={styles.primaryButton} href={contact.phoneHref}>
          Pozovi
        </a>
        <a className={styles.secondaryButton} href={contact.emailHref}>
          Pošalji email
        </a>
        <Link className={styles.ghostButton} href="/prodavnice">
          Pronađi prodavnicu
        </Link>
      </div>

      <p className={styles.editableNote}>{contact.editableNote}</p>
    </section>
  );
}
