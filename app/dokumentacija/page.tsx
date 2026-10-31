import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { DocumentLibrary } from "@/components/sistemi/DocumentLibrary";
import { InquiryForm } from "@/components/sistemi/InquiryForm";
import { SistemiSubnav } from "@/components/sistemi/SistemiSubnav";
import styles from "@/components/sistemi/Sistemi.styles";
import { companyContact } from "@/lib/company-contact";
import { breadcrumbJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { getDocumentLibrary, LIBRARY_TYPE_LABELS, type LibraryDocType } from "@/lib/sistemi/document-library";
import { getSistemiNavLinks } from "@/lib/sistemi/pages";

export const metadata: Metadata = pageMetadata({
  title: "Katalog i tehnički listovi",
  description:
    "Tehnički i bezbednosni listovi, uputstva i katalozi proizvođača za proizvode iz našeg kataloga, sa pretragom po nazivu, šifri i brendu.",
  path: "/dokumentacija",
  imageAlt: "Katalog i tehnički listovi",
});

const GUIDE: { type: LibraryDocType; question: string; answer: string }[] = [
  {
    type: "tds",
    question: "Kako se materijal meša, nanosi i suši?",
    answer: "Tehnički list: odnos mešanja, dizna i pritisak, broj slojeva, vreme odzračivanja i sušenja.",
  },
  {
    type: "sds",
    question: "Koje su opasnosti i koja zaštitna oprema treba?",
    answer: "Bezbednosni list: opasnosti, rukovanje, skladištenje i lična zaštitna oprema.",
  },
  {
    type: "uputstvo",
    question: "Kako se koristi i održava alat ili uređaj?",
    answer: "Uputstvo proizvođača: sklapanje, rad, čišćenje i rezervni delovi.",
  },
];

export default function DokumentacijaPage() {
  const library = getDocumentLibrary();
  const typeCounts = (Object.keys(LIBRARY_TYPE_LABELS) as LibraryDocType[])
    .map((type) => ({ type, count: library.items.filter((item) => item.type === type).length }))
    .filter((entry) => entry.count > 0);
  const brandMap = new Map<string, { slug: string; name: string; count: number }>();
  for (const item of library.items) {
    for (const brand of item.brands) {
      const entry = brandMap.get(brand.slug) ?? { ...brand, count: 0 };
      entry.count += 1;
      brandMap.set(brand.slug, entry);
    }
  }
  const brandCounts = [...brandMap.values()].sort((first, second) => second.count - first.count);
  // Veza na stranicu proizvođača nije dokument (fajl) i broji se odvojeno.
  const files = library.items.filter((item) => !item.viaProductPage);
  const external = files.filter((item) => item.external).length;
  const manufacturerPages = library.items.length - files.length;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Katalog i tehnički listovi", path: "/dokumentacija" },
          ]),
        )}
      />
      <div className={styles.pageShell}>
        <main className={styles.main}>
          <SeoBreadcrumbs
            items={[
              { name: "Početna", path: "/" },
              { name: "Katalog i tehnički listovi", path: "/dokumentacija" },
            ]}
          />
          <SistemiSubnav activeHref="/dokumentacija" links={getSistemiNavLinks()} />

          <header className={styles.hero}>
            <p className={styles.kicker}>Sistemi i programi</p>
            <h1 className={styles.title}>Katalog i tehnički listovi</h1>
            <p className={styles.lead}>
              Dokumenti proizvođača za proizvode iz našeg kataloga. Pre rada proverite da je list za tačno Vaš proizvod i da je verzija
              važeća.
            </p>
            <ul className={styles.counters} style={{ "--counter-cols": typeCounts.length <= 6 ? typeCounts.length : Math.ceil(typeCounts.length / 2) } as React.CSSProperties}>
              {typeCounts.map((entry) => (
                <li className={styles.counter} key={entry.type}>
                  <span className={styles.counterValue}>{entry.count}</span>
                  <span className={styles.counterLabel}>{LIBRARY_TYPE_LABELS[entry.type]}</span>
                </li>
              ))}
            </ul>
            <p className={styles.formNote}>
              Ukupno {files.length} dokumenata; {external} se otvara na sajtu proizvođača
              {manufacturerPages ? `, a uz još ${manufacturerPages} vodi veza „Dokumentacija na sajtu proizvođača“ (bez direktnog PDF-a)` : ""}. Dokumenti stoje uz{" "}
              {library.productCount - library.productsWithoutDocument} od {library.productCount} proizvoda u katalogu. Katalozi brendova su
              i na stranici <Link className={styles.textLink} href="/katalozi">Katalozi i dokumentacija</Link>.
            </p>
          </header>

          <section aria-labelledby="vodic-naslov" className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionKicker}>Pomoć</p>
              <h2 className={styles.sectionTitle} id="vodic-naslov">
                Koji dokument mi treba?
              </h2>
            </div>
            <ul className={styles.systems}>
              {GUIDE.map((entry) => (
                <li className={styles.system} key={entry.type}>
                  <h3 className={styles.systemName}>{entry.question}</h3>
                  <p className={styles.systemPurpose}>{entry.answer}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="dokumenti-naslov" className={styles.section} id="dokumenti">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionKicker}>Biblioteka</p>
              <h2 className={styles.sectionTitle} id="dokumenti-naslov">
                Dokumenti
              </h2>
            </div>
            <DocumentLibrary
              brandCounts={brandCounts}
              initialItems={library.items.slice(0, 24)}
              typeCounts={typeCounts}
              typeLabels={LIBRARY_TYPE_LABELS}
            />
          </section>

          <section aria-labelledby="zahtev-naslov" className={styles.section} id="zahtev">
            <div className={`${styles.panel} ${styles.formPanel}`}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionKicker}>Nema lista?</p>
                <h2 className={styles.sectionTitle} id="zahtev-naslov">
                  Zatražite dokument
                </h2>
                <p className={styles.sectionLead}>
                  Za {library.productsWithoutDocument} proizvoda iz kataloga dokument još nije na sajtu. Navedite proizvod ili šifru i
                  koji list Vam treba.
                </p>
              </div>
              <InquiryForm
                context={[["Zahtev", "Dokument proizvođača"]]}
                email={companyContact.email}
                emailHref={companyContact.emailHref}
                extraField={{ label: "Proizvod ili šifra", placeholder: "Na primer: R-M P 2A41" }}
                messageLabel="Koji dokument tražite"
                messagePlaceholder="Na primer: tehnički i bezbednosni list"
                submitLabel="Pripremite zahtev"
                topic="Proizvod"
              />
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
