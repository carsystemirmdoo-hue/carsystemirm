import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { B2BCooperation } from "@/components/sistemi/B2BCooperation";
import { SistemiSubnav } from "@/components/sistemi/SistemiSubnav";
import styles from "@/components/sistemi/Sistemi.styles";
import { getListedCarsystemBrands } from "@/lib/carsystem-data";
import { companyContact } from "@/lib/company-contact";
import { breadcrumbJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { getSistemiNavLinks } from "@/lib/sistemi/pages";

export const metadata: Metadata = pageMetadata({
  title: "B2B saradnja",
  description: "Poslovna saradnja za radionice, servise i prodajna mesta: predlog saradnje i prijava za postojeće kupce.",
  path: "/b2b-saradnja",
  imageAlt: "B2B saradnja",
});

export default function B2BSaradnjaPage() {
  const brands = getListedCarsystemBrands();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "B2B saradnja", path: "/b2b-saradnja" },
          ]),
        )}
      />
      <div className={styles.pageShell}>
        <main className={styles.main}>
          <SeoBreadcrumbs
            items={[
              { name: "Početna", path: "/" },
              { name: "B2B saradnja", path: "/b2b-saradnja" },
            ]}
          />
          <SistemiSubnav activeHref="/b2b-saradnja" links={getSistemiNavLinks()} />

          <header className={styles.hero}>
            <p className={styles.kicker}>Sistemi i programi</p>
            <h1 className={styles.title}>Poslovna saradnja za radionice i prodajna mesta</h1>
            <p className={styles.lead}>
              Za lakirnice, servise i prodajna mesta koji žele da rade sa programom iz naše ponude. Recite nam ko ste i šta Vam treba;
              postojeći kupci se prijavljuju u portal.
            </p>
            <div className={styles.actions}>
              <a className={`${styles.primaryButton} cs-cta`} data-cta-fill="red" href="#forma">
                <span>Predložite saradnju</span>
              </a>
              <Link className={`${styles.secondaryButton} cs-cta`} data-cta-on="theme" href="/prijava">
                <span>Prijava za kupce</span>
              </Link>
            </div>
            <p className={styles.formNote}>
              Tražite gde da kupite materijal za svoje vozilo?{" "}
              <Link className={styles.textLink} href="/prodavnice">
                Pronađite najbližu prodavnicu
              </Link>
              .
            </p>
          </header>

          <section aria-labelledby="brendovi-naslov" className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionKicker}>Ponuda</p>
              <h2 className={styles.sectionTitle} id="brendovi-naslov">
                Brendovi u ponudi
              </h2>
            </div>
            <ul className={styles.chips}>
              {brands.map((brand) => (
                <li key={brand.slug}>
                  <Link className={styles.chip} href={`/brendovi/${brand.slug}`}>
                    {brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <B2BCooperation email={companyContact.email} emailHref={companyContact.emailHref} />

          <section aria-labelledby="kupci-naslov" className={styles.section} id="kupci">
            <div className={styles.band}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionKicker}>Postojeći kupci</p>
                <h2 className={styles.sectionTitle} id="kupci-naslov">
                  Prijava u portal
                </h2>
                <p>Kupac sa nalogom se prijavljuje u portal. Cene se ne prikazuju na javnom sajtu.</p>
              </div>
              <Link className={`${styles.secondaryButton} cs-cta`} data-cta-on="theme" href="/prijava">
                <span>Prijava za kupce</span>
              </Link>
            </div>
          </section>

          <section aria-labelledby="mreza-naslov" className={styles.section} id="mreza">
            <div className={styles.band}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionKicker}>Partnerska mreža</p>
                <h2 className={styles.sectionTitle} id="mreza-naslov">
                  Za krajnje kupce
                </h2>
                <p>Materijal za svoje vozilo kupujete u prodajnim mestima partnerske mreže.</p>
              </div>
              <Link className={`${styles.primaryButton} cs-cta`} data-cta-fill="red" href="/prodavnice">
                <span>Pronađite najbližu prodavnicu</span>
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
