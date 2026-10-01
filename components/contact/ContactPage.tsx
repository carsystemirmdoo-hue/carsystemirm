import { Suspense } from "react";
import { ContactForm, type ContactInitialValues } from "@/components/contact/ContactForm";
import { ContactQueryForm } from "@/components/contact/ContactQueryForm";
import { ContactInfoCard } from "@/components/contact/ContactInfoCard";
import { Footer } from "@/components/layout/Footer";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import type { CompanyContact } from "@/lib/company-contact";
import type { PartnerStore } from "@/lib/partner-stores";
import styles from "./ContactPage.module.css";

export function ContactPage({
  contact,
  initialValues,
  stores,
}: {
  contact: CompanyContact;
  initialValues: ContactInitialValues;
  stores: PartnerStore[];
}) {
  return (
    <div className={styles.pageShell}>
      <main className={styles.main}>
        <SeoBreadcrumbs
          items={[
            { name: "Početna", path: "/" },
            { name: "Kontakt", path: "/kontakt" },
          ]}
        />
        <section className={styles.hero} aria-labelledby="contact-title">
          <p className={`${styles.kicker} ${styles.heroEyebrow}`}>Kontakt i upiti</p>
          <div className={styles.heroGrid}>
            <h1 className={`${styles.title} ${styles.titleReveal}`} id="contact-title">
              Kome da se obratite u Carsystem timu
            </h1>
            <p className={`${styles.subtitle} ${styles.subtitleReveal}`}>
              Tim usmerava upite ka proizvodu, tehničkoj podršci, prodajnim
              mestima ili poslovnoj saradnji — izaberite razlog i dobićete pravi
              kontekst odmah ispod.
            </p>
          </div>
        </section>

        <Suspense
          fallback={
            <ContactForm
              contact={contact}
              initialValues={initialValues}
              stores={stores}
            />
          }
        >
          <ContactQueryForm contact={contact} stores={stores} />
        </Suspense>

        <ContactInfoCard contact={contact} />

        <section className={styles.closing} aria-labelledby="contact-closing-title">
          <p className={styles.sectionKicker}>Partnerska mreža</p>
          <h2 id="contact-closing-title">
            Jedan upit i tim Vas usmerava na pravu adresu.
          </h2>
          <SplitContactCta inquiryHref="/prodavnice" inquiryLabel="Pronađite prodavnicu" />
        </section>
      </main>
      <Footer />
    </div>
  );
}
