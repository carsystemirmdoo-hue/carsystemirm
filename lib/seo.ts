import type { Metadata } from "next";
import type { CarsystemBrand, CarsystemProduct, PublicProgramGroup } from "@/lib/carsystem-data";
import { companyContact } from "@/lib/company-contact";

export const siteConfig = {
  name: "Carsystem i R-M Inđija",
  shortName: "Carsystem RM",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  locale: "sr_RS",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}

export function titleWithSite(title: string) {
  return `${title} | ${siteConfig.name}`;
}

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const absoluteTitle = title.includes(siteConfig.name) ? title : titleWithSite(title);
  const url = absoluteUrl(path);

  return {
    title: { absolute: absoluteTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: absoluteTitle,
      description,
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      type,
      url,
    },
  };
}

export function jsonLd(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: absoluteUrl("/"),
    address: {
      "@type": "PostalAddress",
      addressLocality: companyContact.city,
      addressCountry: companyContact.country,
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: companyContact.email,
      telephone: companyContact.phone,
      contactType: "customer support",
      areaServed: "RS",
      availableLanguage: ["sr-Latn"],
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function brandJsonLd(brand: CarsystemBrand) {
  return {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    description: brand.description,
    url: absoluteUrl(`/brendovi/${brand.slug}`),
    logo: absoluteUrl(brand.logo),
  };
}

export function programJsonLd(program: PublicProgramGroup) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: program.name,
    description: program.description,
    url: absoluteUrl(`/program/${program.slug}`),
  };
}

export function productJsonLd(
  product: CarsystemProduct,
  brandName: string,
  categoryName?: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription ?? product.shortDescription,
    sku: product.sku,
    category: categoryName,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    image: product.productImage ? absoluteUrl(product.productImage.src) : undefined,
    url: absoluteUrl(`/proizvodi/${product.slug}`),
  };
}
