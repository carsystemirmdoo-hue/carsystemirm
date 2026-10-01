import type { CompanyContact } from "@/lib/company-contact";
import styles from "./ContactPage.module.css";

export function ContactInfoCard({ contact }: { contact: CompanyContact }) {
  // Nepotvrđen podatak (null) se izostavlja — bez praznog reda i bez `tel:` linka.
  const rows: Array<{ label: string; value: string | null; href?: string | null; ariaLabel?: string }> = [
    {
      label: "Telefon kancelarije",
      value: contact.phone,
      href: contact.phoneHref,
      ariaLabel: contact.phone ? `Pozovite kancelariju: ${contact.phone}` : undefined,
    },
    {
      label: "E-pošta",
      value: contact.email,
      href: contact.emailHref,
      ariaLabel: `Pišite na ${contact.email}`,
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
    <>
      <section className={styles.directory} id="contact-info" aria-labelledby="contact-directory-title">
        <div>
          <p className={styles.indexKicker}>02 · Direktan kontakt</p>
          <h2 className="sr-only" id="contact-directory-title">
            Direktan kontakt
          </h2>
        </div>

        <dl className={styles.directoryGrid}>
          {rows.filter((row) => row.value).map((row) => {
            const value = row.href ? (
              <a href={row.href} aria-label={row.ariaLabel}>
                {row.value}
              </a>
            ) : (
              row.value
            );

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

      {contact.salesContacts.length ? (
        <section
          className={styles.directory}
          id="contact-sales-regions"
          aria-labelledby="contact-sales-title"
        >
          <div>
            <p className={styles.indexKicker}>03 · Komercijalisti po regionima</p>
            <h2 className="sr-only" id="contact-sales-title">
              Komercijalisti po regionima
            </h2>
          </div>

          <dl className={styles.directoryGrid}>
            {contact.salesContacts.map((sales) => (
              <div className={styles.directoryRow} key={sales.region}>
                <dt>{sales.region}</dt>
                <dd>
                  <a
                    href={sales.phoneHref}
                    aria-label={`Pozovite komercijalistu za region ${sales.region}: ${sales.phone}`}
                  >
                    {sales.phone}
                  </a>
                </dd>
                <span aria-hidden="true">→</span>
              </div>
            ))}
          </dl>

          <p className={styles.directoryNote}>
            Za ponudu i posetu u Vašem regionu pozovite komercijalistu za taj region. Za sva
            ostala pitanja pozovite kancelariju.
          </p>
        </section>
      ) : null}
    </>
  );
}
