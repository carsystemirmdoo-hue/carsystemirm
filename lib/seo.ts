import type { Metadata } from "next";
import type {
  CarsystemBrand,
  CarsystemProduct,
  PublicProgramGroup,
} from "@/lib/carsystem-data";
import type { PartnerStore } from "@/lib/partner-stores";
import {
  buildPageMetadata,
  titleWithSite,
} from "@/lib/seo/metadata-builders";
import {
  absoluteSeoUrl,
  seoSiteConfig,
} from "@/lib/seo/site-config";

export const siteConfig = seoSiteConfig;

export function absoluteUrl(path = "/") {
  return absoluteSeoUrl(path);
}

export { titleWithSite };

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  image,
  imageAlt,
  index = true,
  follow = true,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  index?: boolean;
  follow?: boolean;
}): Metadata {
  return buildPageMetadata({
    title,
    description,
    path,
    type,
    image,
    imageAlt,
    index,
    follow,
  });
}

export function jsonLd(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029"),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${absoluteUrl("/")}#organization`,
        name: siteConfig.legalName,
        url: absoluteUrl("/"),
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(siteConfig.logo),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${absoluteUrl("/")}#website`,
        url: absoluteUrl("/"),
        name: siteConfig.name,
        inLanguage: siteConfig.language,
        publisher: {
          "@id": `${absoluteUrl("/")}#organization`,
        },
      },
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl("/")}#webpage`,
        url: absoluteUrl("/"),
        name: siteConfig.defaultTitle,
        description: siteConfig.defaultDescription,
        inLanguage: siteConfig.language,
        isPartOf: {
          "@id": `${absoluteUrl("/")}#website`,
        },
        about: {
          "@id": `${absoluteUrl("/")}#organization`,
        },
      },
    ],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(items.at(-1)?.path ?? "/")}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function brandJsonLd(brand: CarsystemBrand) {
  const url = absoluteUrl(`/brendovi/${brand.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Brand",
        "@id": `${url}#brand`,
        name: brand.name,
        description: brand.description,
        url,
        logo: absoluteUrl(brand.logo),
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        name: `${brand.name} proizvodi i sistemi`,
        description: brand.overview ?? brand.description,
        url,
        inLanguage: siteConfig.language,
        about: {
          "@id": `${url}#brand`,
        },
        isPartOf: {
          "@id": `${absoluteUrl("/")}#website`,
        },
      },
    ],
  };
}

export function programJsonLd(program: PublicProgramGroup) {
  const url = absoluteUrl(`/program/${program.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: program.name,
    description: program.description,
    url,
    inLanguage: siteConfig.language,
    isPartOf: {
      "@id": `${absoluteUrl("/")}#website`,
    },
  };
}

export function collectionPageJsonLd({
  name,
  description,
  path,
  itemUrls = [],
}: {
  name: string;
  description: string;
  path: string;
  itemUrls?: string[];
}) {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name,
    description,
    url,
    inLanguage: siteConfig.language,
    isPartOf: {
      "@id": `${absoluteUrl("/")}#website`,
    },
    mainEntity: itemUrls.length
      ? {
          "@type": "ItemList",
          itemListElement: itemUrls.map((itemUrl, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(itemUrl),
          })),
        }
      : undefined,
  };
}

function visibleProductFacts(product: CarsystemProduct) {
  if (product.detail) {
    if (
      product.detail.reviewStatus !== "confirmed" ||
      product.detail.technicalFacts?.reviewStatus !== "confirmed"
    ) {
      return [];
    }
    return product.detail.technicalFacts.content.filter(
      (fact) => fact.reviewStatus === "confirmed" && fact.label && fact.value,
    );
  }
  return product.specifications.filter((fact) => fact.label && fact.value);
}

export function productJsonLd(
  product: CarsystemProduct,
  brandName: string,
  categoryName?: string,
) {
  const url = absoluteUrl(`/proizvodi/${product.slug}`);
  const images = [product.productImage, ...product.galleryImages]
    .filter((image): image is NonNullable<typeof image> => Boolean(image))
    .map((image) => absoluteUrl(image.src))
    .filter((image, index, all) => all.indexOf(image) === index);
  const additionalProperty = visibleProductFacts(product).map((fact) => ({
    "@type": "PropertyValue",
    name: fact.label,
    value: fact.value,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: product.name,
    description: product.seoDescription ?? product.shortDescription,
    image: images.length ? images : undefined,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    category: categoryName,
    additionalProperty: additionalProperty.length
      ? additionalProperty
      : undefined,
  };
}

export function localBusinessJsonLd(stores: PartnerStore[]) {
  const verifiedStores = stores.filter(
    (store) => store.isPublic && store.verificationStatus === "verified",
  );
  const pageUrl = absoluteUrl("/prodavnice");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: "Prodajna i partnerska mreža",
        inLanguage: siteConfig.language,
        isPartOf: {
          "@id": `${absoluteUrl("/")}#website`,
        },
      },
      ...verifiedStores.map((store) => ({
        "@type": store.type === "store" ? "Store" : "LocalBusiness",
        "@id": `${pageUrl}#${store.id}`,
        name: store.name,
        url: `${pageUrl}#${store.id}`,
        address: {
          "@type": "PostalAddress",
          streetAddress: store.address,
          addressLocality: store.city,
          addressCountry: "RS",
        },
        telephone: store.phone,
        geo:
          Number.isFinite(store.latitude) && Number.isFinite(store.longitude)
            ? {
                "@type": "GeoCoordinates",
                latitude: store.latitude,
                longitude: store.longitude,
              }
            : undefined,
        hasMap:
          Number.isFinite(store.latitude) && Number.isFinite(store.longitude)
            ? `https://www.openstreetmap.org/?mlat=${store.latitude}&mlon=${store.longitude}`
            : undefined,
        parentOrganization: {
          "@id": `${absoluteUrl("/")}#organization`,
        },
      })),
    ],
  };
}
