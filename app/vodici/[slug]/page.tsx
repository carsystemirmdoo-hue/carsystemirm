import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { guides } from "@/data/knowledge/guides";
import {
  guideBodyWordCount,
  isGuidePublishable,
  publishedGuides,
  type Guide,
} from "@/lib/knowledge/guides";
import { getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { absoluteUrl, breadcrumbJsonLd, jsonLd, pageMetadata, siteConfig } from "@/lib/seo";

/**
 * Guide detail route.
 *
 * `generateStaticParams` is driven by `publishedGuides()`, and `dynamicParams`
 * is false. A draft or unverified guide therefore has no URL at all — it 404s
 * rather than rendering an empty shell. This is the mechanism that keeps
 * "a data record exists" from becoming "an indexable page exists".
 *
 * Today that means this route generates zero pages, which is the correct and
 * intended output while every guide body is still awaiting expert review.
 */

type GuideRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedGuides(guides).map((guide) => ({ slug: guide.slug }));
}

function findPublishableGuide(slug: string): Guide | undefined {
  const guide = guides.find((item) => item.slug === slug);
  return guide && isGuidePublishable(guide) ? guide : undefined;
}

export async function generateMetadata({
  params,
}: GuideRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = findPublishableGuide(slug);
  if (!guide) return {};

  return pageMetadata({
    title: guide.title,
    description: guide.summary,
    path: `/vodici/${guide.slug}`,
    type: "article",
    imageAlt: guide.title,
  });
}

export default async function GuideRoute({ params }: GuideRouteProps) {
  const { slug } = await params;
  const guide = findPublishableGuide(slug);
  if (!guide) notFound();

  const route = `/vodici/${guide.slug}`;
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Vodiči", path: "/vodici" },
    { name: guide.title, path: route },
  ];
  const sections = guide.body.value ?? [];
  const recommended = (guide.recommendedProductSlugs ?? [])
    .map((productSlug) => getCarsystemProductBySlug(productSlug))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  /**
   * `Article` rather than `HowTo`: HowTo is only appropriate when the page is
   * genuinely a step-by-step procedure, and that depends on the guide's own
   * `process` claim being verified. Emitting HowTo for prose would be schema
   * that does not match visible content.
   */
  const articleNode = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${absoluteUrl(route)}#article`,
    headline: guide.title,
    description: guide.summary,
    url: absoluteUrl(route),
    inLanguage: siteConfig.language,
    datePublished: guide.publishedAt,
    dateModified: guide.lastReviewedAt ?? guide.publishedAt,
    wordCount: guideBodyWordCount(guide),
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(articleNode)}
      />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <SeoBreadcrumbs items={breadcrumbs} />
        <h1 className="mt-6 font-[var(--font-display)] text-4xl font-black uppercase tracking-tight sm:text-5xl">
          {guide.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">{guide.summary}</p>

        {sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>
            <p className="mt-3 text-base leading-7">{section.body}</p>
          </section>
        ))}

        {recommended.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight">Preporučeni proizvodi</h2>
            <ul className="mt-4 space-y-2">
              {recommended.map((product) => (
                <li key={product.slug}>
                  <Link
                    className="underline underline-offset-4"
                    href={`/proizvodi/${product.slug}`}
                  >
                    {product.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {guide.sources?.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight">Izvori</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {guide.sources.map((source) => (
                <li key={source.label}>
                  {source.label}
                  {source.locator ? ` — ${source.locator}` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
