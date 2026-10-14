import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { guides } from "@/data/knowledge/guides";
import { publishedGuides } from "@/lib/knowledge/guides";
import { pageMetadata } from "@/lib/seo";

/**
 * Guide index.
 *
 * While no guide has passed the publication gate this page is `noindex` and is
 * absent from the sitemap, because an index of nothing is exactly the kind of
 * thin page the brief rules out. It flips to indexable automatically the moment
 * a guide is expert-verified — no separate switch to remember.
 */
const published = publishedGuides(guides);

export const metadata: Metadata = pageMetadata({
  title: "Vodiči za auto lakiranje",
  description:
    "Stručno pregledani vodiči kroz proces auto lakiranja, pripremu površine i izbor materijala.",
  path: "/vodici",
  index: published.length > 0,
  imageAlt: "Carsystem i R-M vodiči",
});

export default function GuidesIndexPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6">
        <p className="flex items-center gap-2.5 font-[family-name:var(--font-technical)] text-[length:var(--ds-font-label)] font-medium uppercase tracking-[var(--ds-tracking-label)] text-[color:var(--ds-c-accent-text)] before:h-0.5 before:w-6 before:flex-none before:bg-[var(--ds-c-accent)] before:content-['']">
          Vodiči
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[length:var(--ds-font-h1)] font-extrabold leading-[1.05] tracking-[-0.02em]">
          Vodiči za auto lakiranje
        </h1>

        {published.length ? (
          <ul className="mt-10 space-y-6">
            {published.map((guide) => (
              <li key={guide.slug}>
                <Link
                  className="font-[family-name:var(--font-body)] text-[length:var(--ds-font-h3)] font-semibold underline decoration-[var(--ds-c-line-strong)] decoration-1 underline-offset-4 hover:decoration-current hover:decoration-2"
                  href={`/vodici/${guide.slug}`}
                >
                  {guide.title}
                </Link>
                <p className="mt-2 max-w-[68ch] text-base leading-[1.6] text-[color:var(--ds-c-text-2)]">
                  {guide.summary}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-5 max-w-[68ch] text-[length:var(--ds-font-lead)] leading-[1.55] text-[color:var(--ds-c-text-2)]">
              Vodiči su u pripremi. Objavljujemo ih tek nakon što ih pregleda i
              odobri Carsystem tehnički tim, pa na ovoj stranici nema
              nepotvrđenih tehničkih uputstava.
            </p>
            <p className="mt-4 max-w-[68ch] text-base leading-[1.6] text-[color:var(--ds-c-text-2)]">
              Za konkretno pitanje o proizvodu ili procesu, obratite se našem
              timu ili pogledajte katalog.
            </p>
            <nav className="mt-8 flex flex-wrap gap-3" aria-label="Korisni linkovi">
              <Link
                className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center rounded-[var(--ds-ctl-radius)] bg-[var(--ds-c-accent)] px-5 text-[15px] font-semibold text-[color:var(--ds-c-on-accent)] transition-colors hover:bg-[var(--ds-c-accent-hover)]"
                href="/kontakt"
              >
                Kontakt
              </Link>
              <Link
                className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center rounded-[var(--ds-ctl-radius)] border border-[var(--ds-c-text)] px-5 text-[15px] font-semibold transition-colors hover:bg-[var(--ds-c-surface-2)]"
                href="/katalog"
              >
                Katalog
              </Link>
            </nav>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
