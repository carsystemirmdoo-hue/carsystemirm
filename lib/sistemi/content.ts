import "server-only";

import bojeILakovi from "@/content/sistemi/boje-i-lakovi.json";
import izvori from "@/content/sistemi/izvori.json";
import pistoljiIOprema from "@/content/sistemi/pistolji-i-oprema.json";
import poliranje from "@/content/sistemi/poliranje.json";
import potrosniMaterijal from "@/content/sistemi/potrosni-materijal.json";
import pripremaIAbrazivi from "@/content/sistemi/priprema-i-abrazivi.json";
import slikeBezPotvrde from "@/content/sistemi/slike-bez-potvrde-prava.json";
import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import { getPublicSavetBySlug } from "@/lib/saveti";
import { sourceKey } from "@/lib/sistemi/keys";
import type {
  ResolvedGuide,
  ResolvedProduct,
  ResolvedSource,
  SistemiContent,
  SistemiIzvor,
  SourceRef,
} from "@/lib/sistemi/types";

const CONTENT: Record<string, SistemiContent> = {
  "boje-i-lakovi": bojeILakovi as unknown as SistemiContent,
  "priprema-i-abrazivi": pripremaIAbrazivi as unknown as SistemiContent,
  "pistolji-i-oprema": pistoljiIOprema as unknown as SistemiContent,
  poliranje: poliranje as unknown as SistemiContent,
  "potrosni-materijal": potrosniMaterijal as unknown as SistemiContent,
};

const IZVORI = izvori as Record<string, SistemiIzvor>;
const PENDING_IMAGE_IDS = new Set((slikeBezPotvrde as { slike: string[] }).slike);

export function getSistemiContent(programSlug: string): SistemiContent | undefined {
  return CONTENT[programSlug];
}

export function getSistemiProgramSlugs(): string[] {
  return Object.keys(CONTENT);
}

export function getSistemiIzvor(id: string): SistemiIzvor | undefined {
  return IZVORI[id];
}

export function resolveSource(ref: SourceRef): ResolvedSource | null {
  const izvor = IZVORI[ref.doc];
  if (!izvor) return null;
  const label = izvor.verzija ? `${izvor.naziv}, verzija ${izvor.verzija}` : izvor.naziv;
  return { label, href: izvor.dokument ?? izvor.url, strana: ref.strana };
}

/**
 * Slika proizvoda sme na stranice sistema samo ako njeno pravo prikaza nije na spisku
 * čekanja (`IMAGE_RIGHTS_REVIEW.csv`); inače se prikazuje neutralno polje.
 */
function approvedImage(product: CarsystemProduct): ResolvedProduct["image"] {
  if (!product.productImage) return null;
  if (PENDING_IMAGE_IDS.has(`${product.brandSlug}__${product.slug}`)) return null;
  return { src: product.productImage.src, alt: product.productImage.alt || product.name };
}

const TECHNICAL_DOCUMENT = /tehni|technical|tds|informacij/i;

function technicalDocument(product: CarsystemProduct): ResolvedProduct["document"] {
  const document = (product.documents ?? []).find(
    (item) => item.status === "available" && item.href && TECHNICAL_DOCUMENT.test(`${item.title} ${item.href}`),
  );
  if (!document?.href) return undefined;
  return { title: document.title, href: document.href, external: !document.href.startsWith("/") };
}

export function resolveProduct(slug: string): ResolvedProduct | null {
  const product = getCarsystemProductBySlug(slug);
  if (!product) return null;
  const brand = getCarsystemBrandBySlug(product.brandSlug);
  return {
    slug: product.slug,
    name: product.name,
    brandName: brand?.name ?? product.brandSlug,
    href: `/proizvodi/${product.slug}`,
    image: approvedImage(product),
    document: technicalDocument(product),
  };
}

/** Vodič se povezuje samo kada je javno objavljen; neobjavljen vodič se ne pominje. */
export function resolveGuide(slug: string): ResolvedGuide | null {
  const savet = getPublicSavetBySlug(slug);
  if (!savet) return null;
  return { slug, title: savet.naslov, href: `/vodici/${slug}` };
}

/** Svi proizvodi, izvori i vodiči na koje sadržaj upućuje, razrešeni jednom. */
export function collectReferences(content: SistemiContent) {
  const productSlugs = new Set<string>();
  const sourceRefs = new Map<string, SourceRef>();
  const guideSlugs = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.products)) {
      for (const slug of record.products) if (typeof slug === "string") productSlugs.add(slug);
    }
    if (Array.isArray(record.guides)) {
      for (const slug of record.guides) if (typeof slug === "string") guideSlugs.add(slug);
    }
    if (Array.isArray(record.sources)) {
      for (const ref of record.sources as SourceRef[]) sourceRefs.set(sourceKey(ref), ref);
    }
    if (record.source && typeof record.source === "object") {
      const ref = record.source as SourceRef;
      sourceRefs.set(sourceKey(ref), ref);
    }
    for (const nested of Object.values(record)) if (nested && typeof nested === "object") visit(nested);
  };
  visit(content);

  const products: Record<string, ResolvedProduct> = {};
  for (const slug of productSlugs) {
    const product = resolveProduct(slug);
    if (product) products[slug] = product;
  }
  const sources: Record<string, ResolvedSource> = {};
  for (const [key, ref] of sourceRefs) {
    const source = resolveSource(ref);
    if (source) sources[key] = source;
  }
  const guides: Record<string, ResolvedGuide> = {};
  for (const slug of guideSlugs) {
    const guide = resolveGuide(slug);
    if (guide) guides[slug] = guide;
  }
  return { products, sources, guides };
}
