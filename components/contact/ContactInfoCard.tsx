import type { CompanyContact } from "@/lib/company-contact";
import styles from "./ContactPage.module.css";

export function ContactInfoCard({ contact }: { contact: CompanyContact }) {
  // Nepotvrđen podatak (null) se izostavlja — bez praznog reda i bez `tel:` linka.
  const rows: Array<{ label: string; value: string | null; href?: string | null }> = [
    {
      label: "Telefon",
      value: contact.phone,
      href: contact.phoneHref,
    },
    {
      label: "E-pošta",
      value: contact.email,
      href: contact.emailHref,
    },
    {
      label: "Lokacija",
      value: contact.locationLabel,
    },
    {
      label: "Radno vreme",
      value: contact.workingHours,
    },
  ];

  return (
    <section className={styles.directory} id="contact-info" aria-labelledby="contact-directory-title">
      <div>
        <p className={styles.indexKicker}>02 · Direktan kontakt</p>
        <h2 className="sr-only" id="contact-directory-title">
          Direktan kontakt
        </h2>
      </div>

      <dl className={styles.directoryGrid}>
        {rows.filter((row) => row.value).map((row) => {
          const value = row.href ? <a href={row.href}>{row.value}</a> : row.value;

          return (
            <div className={styles.directoryRow} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{value}</dd>
              <span aria-hidden="true">{row.href ? "→" : ""}</span>
            </div>
          );
        })}
      </dl>

      <p className={styles.directoryNote}>{contact.partnerNetworkNote}</p>
    </section>
  );
}
