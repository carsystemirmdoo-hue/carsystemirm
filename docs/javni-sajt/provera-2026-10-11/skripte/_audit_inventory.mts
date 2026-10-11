import fs from "node:fs";
import path from "node:path";
import { getAllCarsystemProducts, getAllCarsystemBrands } from "@/lib/carsystem-data";
import { getAllProductFamilies, productCanonicalHref, getConsolidatedVariantSlugs, variantRedirectTarget } from "@/lib/product-families";
const OUT = process.argv[2];
const root = process.cwd();
const pub = (src?: string) => {
  if (!src) return null;
  if (/^https?:/.test(src)) return "external";
  const p = path.join(root, "public", decodeURI(src.split("?")[0]));
  if (fs.existsSync(p)) return "ok";
  // pending-rights from review-assets
  return "missing";
};
const consolidated = getConsolidatedVariantSlugs();
const rows = getAllCarsystemProducts().map((p) => {
  const d: any = p.detail;
  const docs = [...(p.documents ?? []).map((x) => ({ t: x.title, k: x.kind, h: x.href, s: x.status, src: "documents" })),
    ...((d?.documents?.content ?? []) as any[]).map((x) => ({ t: x.title, k: x.kind, h: x.href, s: x.availability, src: "detail" }))];
  return {
    slug: p.slug, brand: p.brandSlug, name: p.name, sku: p.sku, publicCode: p.publicCode, skuInternal: !!p.skuIsInternalOnly,
    program: p.programSlug, taxonomy: p.taxonomyCategory, family: p.family?.id, strategy: p.catalogStrategy ?? p.family?.catalogStrategy,
    canonical: productCanonicalHref(p), redirect: variantRedirectTarget(p), consolidated: consolidated.has(p.slug),
    image: p.productImage?.src ?? null, imageAlt: p.productImage?.alt ?? null, imageFile: pub(p.productImage?.src),
    gallery: p.galleryImages.length, galleryMissing: p.galleryImages.filter((g) => pub(g.src) === "missing").length,
    shortLen: p.shortDescription?.length ?? 0, longLen: p.longDescription?.length ?? 0, purposeLen: p.purpose?.length ?? 0,
    short: p.shortDescription, long: p.longDescription, purpose: p.purpose,
    specs: p.specifications.length, packages: p.packages.map((x) => x.label), volume: p.catalogMetadata?.volume ?? null,
    docs, seoTitle: p.seoTitle ?? null, seoDescription: p.seoDescription ?? null,
    detail: d ? { status: d.reviewStatus, quick: d.quickFacts?.content?.length ?? 0, tech: d.technicalFacts?.content?.length ?? 0,
      variants: d.variants?.content?.rows?.length ?? 0, benefits: d.benefits?.content?.items?.length ?? 0,
      needsConf: JSON.stringify(d).split('"needs_confirmation"').length - 1, lead: d.hero?.lead ?? null } : null,
    publicStatus: p.publicStatus ?? null, variantOptions: p.variantOptions ?? null,
  };
});
const fams = getAllProductFamilies().map((f: any) => ({ slug: f.slug, label: f.label ?? f.name, brand: f.brandSlug, members: (f.variants ?? f.members ?? f.products ?? []).map((m: any) => m.slug ?? m) }));
fs.writeFileSync(OUT, JSON.stringify({ brands: getAllCarsystemBrands().map((b) => ({ slug: b.slug, name: (b as any).name })), products: rows, families: fams }, null, 1));
console.log(rows.length, fams.length);
