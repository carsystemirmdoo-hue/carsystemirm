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
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Vodiči
        </p>
        <h1 className="mt-4 font-[var(--font-display)] text-4xl font-black uppercase tracking-tight sm:text-5xl">
          Vodiči za auto lakiranje
        </h1>

        {published.length ? (
          <ul className="mt-10 space-y-6">
            {published.map((guide) => (
              <li key={guide.slug}>
                <Link
                  className="text-xl font-semibold underline underline-offset-4"
                  href={`/vodici/${guide.slug}`}
                >
                  {guide.title}
                </Link>
                <p className="mt-2 text-base leading-7 text-muted-foreground">
                  {guide.summary}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Vodiči su u pripremi. Objavljujemo ih tek nakon što ih pregleda i
              odobri Carsystem tehnički tim, pa na ovoj stranici nema
              nepotvrđenih tehničkih uputstava.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Za konkretno pitanje o proizvodu ili procesu, obratite se našem
              timu ili pogledajte katalog.
            </p>
            <nav className="mt-8 flex flex-wrap gap-3" aria-label="Korisni linkovi">
              <Link
                className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 font-semibold text-background"
                href="/kontakt"
              >
                Kontakt
              </Link>
              <Link
                className="inline-flex min-h-11 items-center rounded-lg border border-foreground/20 px-5 font-semibold"
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
