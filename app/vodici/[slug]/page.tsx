import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SavetiClanakPrikaz } from "@/components/saveti/SavetiClanakPrikaz";
import { getPublicSaveti, getPublicSavetBySlug } from "@/lib/saveti";
import { getSavetiKategorija } from "@/lib/saveti/kategorije.mjs";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

/**
 * Strana članka.
 *
 * - Javno je samo ono što ima objavljenu verziju u bazi i nije povučeno (lib/saveti).
 * - `dynamicParams = true`: članak objavljen POSLE builda dobija stranu pri prvom zahtevu.
 * - Objava, „Objavite izmene“ i povlačenje osvežavaju keš strane odmah (revalidatePath);
 *   `revalidate` je rezerva.
 * - Ranija adresa (posle izričite promene) trajno preusmerava na trenutnu.
 */
export const revalidate = 60; // = SAVETI_REVALIDATE_SECONDS (Next traži doslovnu vrednost)
export const dynamicParams = true;

type RouteProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPublicSaveti()).map((clanak) => ({ slug: clanak.slug }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const { clanak } = await getPublicSavetBySlug(slug);
  if (!clanak) return {};
  const base = pageMetadata({
    title: clanak.metaNaslov,
    description: clanak.opis,
    path: `/vodici/${clanak.slug}`,
    type: "article",
    imageAlt: clanak.slika?.alt ?? clanak.naslov,
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: clanak.datumObjave,
      modifiedTime: clanak.datumIzmene,
      section: getSavetiKategorija(clanak.kategorija)?.naziv,
      ...(clanak.slika ? { images: [{ url: absoluteUrl(`/vodici/slike/${clanak.slika.id}`), alt: clanak.slika.alt }] } : {}),
    },
  };
}

export default async function SavetRoute({ params }: RouteProps) {
  const { slug } = await params;
  const { clanak, preusmerenje } = await getPublicSavetBySlug(slug);
  if (preusmerenje) permanentRedirect(`/vodici/${preusmerenje}`);
  if (!clanak) notFound();
  return <SavetiClanakPrikaz clanak={clanak} published={await getPublicSaveti()} />;
}
