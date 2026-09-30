import { publicSkuOf } from "@/lib/catalog/public-code";
import type { Metadata } from "next";
import type {
  CarsystemBrand,
  CarsystemProduct,
  PublicProgramGroup,
} from "@/lib/carsystem-data";
import type { ProductFamily } from "@/lib/product-families";
import type { SeoCategoryLanding } from "@/lib/seo/category-landings";
import { getRmCategorySingularName } from "@/lib/seo/category-landings";
import {
  absoluteSeoUrl,
  seoSiteConfig,
} from "@/lib/seo/site-config";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  index?: boolean;
  follow?: boolean;
  /**
   * Canonical target when it differs from the page's own path.
   *
   * Used to consolidate near-duplicate product variants onto their family page.
   * Defaults to `path`, so self-canonicalisation stays the norm and a
   * cross-canonical is always a deliberate, visible decision at the call site.
   */
  canonicalPath?: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimAtWord(value: string, maximum = 165) {
  const normalized = normalizeText(value);
  if ([...normalized].length <= maximum) return normalized;
  const candidate = [...normalized].slice(0, maximum + 1).join("");
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > maximum * 0.7 ? boundary : maximum).trimEnd()}.`;
}

function titleWithSite(title: string) {
  const normalized = normalizeText(title);
  if (
    normalized.includes(seoSiteConfig.shortName) ||
    normalized.includes(seoSiteConfig.name)
  ) {
    return normalized;
  }
  return `${normalized} | ${seoSiteConfig.titleSuffix}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image = seoSiteConfig.defaultOgImage,
  imageAlt,
  type = "website",
  index = true,
  follow = true,
  canonicalPath,
}: PageMetadataInput): Metadata {
  const absoluteTitle = titleWithSite(title);
  const normalizedDescription = trimAtWord(description);
  // og:url follows the canonical, not the page path, so a shared variant link
  // resolves to the same entity the search index consolidates on.
  const canonicalUrl = absoluteSeoUrl(canonicalPath ?? path);
  const socialImage = absoluteSeoUrl(image);
  const shouldIndex = seoSiteConfig.indexingEnabled && index;

  return {
    title: { absolute: absoluteTitle },
    description: normalizedDescription,
    alternates: { canonical: canonicalUrl },
    robots: {
      index: shouldIndex,
      follow: shouldIndex ? follow : follow,
      noarchive: !shouldIndex,
      googleBot: {
        index: shouldIndex,
        follow: shouldIndex ? follow : follow,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: absoluteTitle,
      description: normalizedDescription,
      locale: seoSiteConfig.locale,
      siteName: seoSiteConfig.name,
      type,
      url: canonicalUrl,
      images: [
        {
          url: socialImage,
          alt: imageAlt ?? absoluteTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: absoluteTitle,
      description: normalizedDescription,
      images: [socialImage],
    },
  };
}

export function buildProductFamilyMetadata(family: ProductFamily) {
  const variantCount = family.variants.length;
  const axisLabel = family.variesBy.includes("color") ? "nijansi i varijanti" : "varijanti";
  const description = `${family.name} — pregled od ${variantCount} ${axisLabel} u Carsystem i R-M ponudi. Uporedite šifre i pakovanja i pošaljite upit za dostupnost.`;

  return buildPageMetadata({
    title: `${family.name} — sve varijante`,
    description,
    path: `/proizvodi/grupa/${family.slug}`,
    image: family.representative.productImage?.src ?? seoSiteConfig.defaultOgImage,
    imageAlt: `${family.name}, pregled varijanti`,
  });
}

export function buildProductMetadata({
  brand,
  product,
  canonicalPath,
}: {
  brand: CarsystemBrand;
  product: CarsystemProduct;
  /** Family page URL when this product is a consolidated variant. */
  canonicalPath?: string;
}) {
  const category = product.rmMetadata
    ? getRmCategorySingularName(product.rmMetadata.category)
    : undefined;
  const descriptor = category ? `${brand.name} ${category}` : `${brand.name} proizvod`;
  const title = `${product.name} – ${descriptor}`;
  const baseDescription =
    product.seoDescription ?? product.shortDescription ?? product.purpose;
  // Javna šifra ima prednost: interni `sku` se ne predstavlja kao šifra proizvođača.
  const publicCode = product.publicCode ?? publicSkuOf(product);
  const productIdentifier = publicCode
    ? `Šifra proizvoda ${publicCode}. `
    : "";
  const description = `${productIdentifier}${normalizeText(baseDescription)} Pogledajte dokumentaciju i pošaljite upit za dostupnost proizvoda ${product.name}.`;
  const hasGeneratedRmOg =
    product.brandSlug === "rm" &&
    product.productImage?.src.startsWith("/images/brands/rm/products/");
  const image = hasGeneratedRmOg
    ? `/images/og/products/rm/${product.slug}.jpg`
    : product.productImage?.src ?? seoSiteConfig.defaultOgImage;

  return buildPageMetadata({
    title,
    description,
    path: `/proizvodi/${product.slug}`,
    canonicalPath,
    image,
    imageAlt: `${product.name}, ${brand.name} proizvod`,
  });
}

export function buildBrandMetadata(brand: CarsystemBrand) {
  const image =
    brand.slug === "rm"
      ? "/images/brands/rm/campaign/rm-hero-agilis-color-desktop.webp"
      : seoSiteConfig.defaultOgImage;
  return buildPageMetadata({
    title: `${brand.name} proizvodi i sistemi`,
    description: brand.overview ?? brand.description,
    path: `/brendovi/${brand.slug}`,
    image,
    imageAlt: `${brand.name} program u Carsystem i R-M katalogu`,
  });
}

export function buildProgramMetadata(program: PublicProgramGroup) {
  return buildPageMetadata({
    title: program.name,
    description: program.description,
    path: `/program/${program.slug}`,
    imageAlt: `${program.name}, Carsystem i R-M program`,
  });
}

export function buildCategoryMetadata(category: SeoCategoryLanding) {
  return buildPageMetadata({
    title: category.title,
    description: category.description,
    path: `/kategorije/${category.slug}`,
    image:
      category.slug === "bezbojni-lakovi"
        ? "/images/brands/rm/campaign/rm-hero-agilis-performance-desktop.webp"
        : seoSiteConfig.defaultOgImage,
    imageAlt: `${category.name} u Carsystem i R-M katalogu`,
  });
}

export function buildStoreMetadata() {
  return buildPageMetadata({
    title: "Prodavnice auto lakova i partnerska mreža",
    description:
      "Pronađite javno navedena prodajna mesta i partnerske lokacije za Carsystem i R-M program u Srbiji. Proverite adresu i kontakt pre dolaska.",
    path: "/prodavnice",
    imageAlt: "Carsystem i R-M prodajna i partnerska mreža u Srbiji",
  });
}

export function buildContactMetadata({ index = true }: { index?: boolean } = {}) {
  return buildPageMetadata({
    title: "Kontakt za proizvode i tehničku podršku",
    description:
      "Pošaljite upit za Carsystem i R-M proizvode, tehničku podršku, B2B saradnju ili usmeravanje ka odgovarajućoj prodavnici.",
    path: "/kontakt",
    imageAlt: "Kontakt Carsystem i R-M tima",
    index,
    follow: true,
  });
}

export { titleWithSite, trimAtWord };
