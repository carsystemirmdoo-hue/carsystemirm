import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { SistemiSubnav } from "@/components/sistemi/SistemiSubnav";
import styles from "@/components/sistemi/Sistemi.styles";
import { getAllPublicProgramGroups } from "@/lib/carsystem-data";
import { breadcrumbJsonLd, jsonLd, pageMetadata } from "@/lib/seo";
import { getSistemiContent } from "@/lib/sistemi/content";
import { getDocumentLibrary } from "@/lib/sistemi/document-library";
import { getSistemiNavLinks, getSistemiPageLinks, SISTEMI_HUB_HREF, SISTEMI_PAGE_COPY } from "@/lib/sistemi/pages";

export const metadata: Metadata = pageMetadata({
  title: "Sistemi i programi",
  description: "Postupci za pripremu, boje i lakove, pištolje, poliranje i potrošni materijal, dokumenti proizvođača i poslovna saradnja.",
  path: SISTEMI_HUB_HREF,
  imageAlt: "Sistemi i programi",
});

export default function SistemiHubPage() {
  const programs = new Map(getAllPublicProgramGroups().map((program) => [program.slug, program]));
  const library = getDocumentLibrary();
  const sds = library.items.filter((item) => item.type === "sds").length;
  const tds = library.items.filter((item) => item.type === "tds").length;

  const cards = getSistemiPageLinks().map((link) => {
    const slug = link.href.replace("/program/", "");
    const content = link.href.startsWith("/program/") ? getSistemiContent(slug) : undefined;
    const copy = SISTEMI_PAGE_COPY[slug];
    if (content) {
      return {
        ...link,
        kicker: "Postupak",
        text: copy?.subtitle ?? programs.get(slug)?.description ?? "",
        links: content.jobs.map((job) => ({ href: `${link.href}?posao=${job.id}#poslovi`, label: job.label ?? job.title })),
      };
    }
    if (link.href === "/dokumentacija") {
      return {
        ...link,
        kicker: "Dokumenti",
        text: `${library.items.length} dokumenata proizvođača uz proizvode iz kataloga.`,
        links: [
          { href: "/dokumentacija?vrsta=tds#dokumenti", label: `Tehnički listovi (${tds})` },
          { href: "/dokumentacija?vrsta=sds#dokumenti", label: `Bezbednosni listovi (${sds})` },
        ],
      };
    }
    return {
      ...link,
      kicker: "Saradnja",
      text: "Za radionice, servise i prodajna mesta.",
      links: [
        { href: "/b2b-saradnja#ko-ste", label: "Predložite saradnju" },
        { href: "/prijava", label: "Prijava za kupce" },
      ],
    };
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Sistemi i programi", path: SISTEMI_HUB_HREF },
          ]),
        )}
      />
      <div className={styles.pageShell}>
        <main className={styles.main}>
          <SeoBreadcrumbs
            items={[
              { name: "Početna", path: "/" },
              { name: "Sistemi i programi", path: SISTEMI_HUB_HREF },
            ]}
          />
          <SistemiSubnav activeHref={SISTEMI_HUB_HREF} links={getSistemiNavLinks()} />

          <header className={styles.hero}>
            <h1 className={styles.title}>Sistemi i programi</h1>
            <p className={styles.lead}>
              Postupak za posao koji radite, materijal i proizvodi uz svaki korak, dokumenti proizvođača i poslovna saradnja.
            </p>
          </header>

          <ul className={styles.hubGrid}>
            {cards.map((card) => (
              <li className={styles.hubCard} key={card.href}>
                <p className={styles.sectionKicker}>{card.kicker}</p>
                <h2 className={styles.hubTitle}>
                  <Link href={card.href}>{card.title}</Link>
                </h2>
                {card.text ? <p className={styles.hubText}>{card.text}</p> : null}
                <ul className={styles.hubLinks}>
                  {card.links.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </main>
        <Footer />
      </div>
    </>
  );
}
