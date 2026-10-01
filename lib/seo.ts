import { publicSkuOf } from "@/lib/catalog/public-code";
import type { Metadata } from "next";
import type {
  CarsystemBrand,
  CarsystemProduct,
  PublicProgramGroup,
} from "@/lib/carsystem-data";
import { companyContact } from "@/lib/company-contact";
import { isPubliclyListedStore, type PartnerStore } from "@/lib/partner-stores";
import type { ProductFamily } from "@/lib/product-families";
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
        name: siteConfig.name,
        legalName: siteConfig.legalName,
        taxID: companyContact.pib,
        identifier: {
          "@type": "PropertyValue",
          propertyID: "Matični broj (RS)",
          value: companyContact.mb,
        },
        url: absoluteUrl("/"),
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(siteConfig.logo),
        },
        // Isti potvrđeni podaci kao vidljiv kontakt (lib/company-contact.ts).
        address: {
          "@type": "PostalAddress",
          streetAddress: companyContact.streetAddress,
          postalCode: companyContact.postalCode,
          addressLocality: companyContact.city,
          addressCountry: "RS",
        },
        telephone: companyContact.phoneInternational ?? undefined,
        email: companyContact.email,
        contactPoint: [
          ...(companyContact.phoneInternational
            ? [
                {
                  "@type": "ContactPoint",
                  contactType: "customer service",
                  telephone: companyContact.phoneInternational,
                  email: companyContact.email,
                  areaServed: "RS",
                  availableLanguage: "sr",
                },
              ]
            : []),
          ...companyContact.salesContacts.map((sales) => ({
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: sales.phoneInternational,
            areaServed: { "@type": "AdministrativeArea", name: sales.region },
            availableLanguage: "sr",
          })),
        ],
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
        // Brend bez odobrenog logo fajla ne dobija `logo` — tekstualni naziv nije logotip.
        ...(brand.logo ? { logo: absoluteUrl(brand.logo) } : {}),
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

/**
 * `ProductGroup` for a product family.
 *
 * Emitted only on the family page, which is the indexable entity. `hasVariant`
 * lists every variant as a `Product` stub with its own `@id`, so the variant
 * pages' own `Product` nodes resolve to the same entities rather than
 * competing with them.
 *
 * No `offers` anywhere, consistent with the existing rule: prices are not
 * public, so there is no honest offer to declare.
 */
export function productGroupJsonLd(family: ProductFamily) {
  const url = absoluteUrl(`/proizvodi/grupa/${family.slug}`);
  const variesByLabels: Record<string, string> = {
    color: "color",
    size: "size",
    volume: "size",
    finish: "pattern",
  };

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${url}#productgroup`,
    url,
    name: family.name,
    description: `${family.name} — ${family.variants.length} varijanti u Carsystem i R-M ponudi.`,
    inLanguage: siteConfig.language,
    brand: {
      "@type": "Brand",
      name: family.brandName,
    },
    productGroupID: family.baseProductSlug,
    // Omitted rather than guessed when no axis is defensible.
    variesBy: family.variesBy.length
      ? family.variesBy.map((axis) => variesByLabels[axis] ?? axis)
      : undefined,
    hasVariant: family.variants.map((variant) => ({
      "@type": "Product",
      "@id": `${absoluteUrl(`/proizvodi/${variant.slug}`)}#product`,
      name: variant.name,
      url: absoluteUrl(`/proizvodi/${variant.slug}`),
      // Interni ključ se ne emituje kao SKU (schema.org ga ne zahteva).
      sku: variant.catalogMetadata?.cosmosCode ?? publicSkuOf(variant) ?? undefined,
      // Isto pravilo kao `productJsonLd`: placeholder nije slika proizvoda.
      image:
        variant.productImage && !variant.productImage.src.includes("placeholder-product")
          ? absoluteUrl(variant.productImage.src)
          : undefined,
    })),
  };
}

export function productJsonLd(
  product: CarsystemProduct,
  brandName: string,
  categoryName?: string,
  family?: ProductFamily,
) {
  const url = absoluteUrl(`/proizvodi/${product.slug}`);
  /*
   * `placeholder-product` je sistemski „vizuel u pripremi" prikaz, ne slika
   * proizvoda. `ProductVisualSurface` ga već tretira kao odsustvo slike; ovde
   * se izostavlja iz istog razloga — `Product.image` mora da pokazuje na
   * stvarnu sliku proizvoda ili da ga uopšte nema. Ispravljeno 2026-08-20 dok
   * je SATA stranica bila prvi slučaj koji je to izneo na videlo.
   */
  const images = [product.productImage, ...product.galleryImages]
    .filter((image): image is NonNullable<typeof image> => Boolean(image))
    .filter((image) => !image.src.includes("placeholder-product"))
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
    // Ties a consolidated variant back to its group, matching the canonical.
    isVariantOf: family
      ? {
          "@type": "ProductGroup",
          "@id": `${absoluteUrl(`/proizvodi/grupa/${family.slug}`)}#productgroup`,
          name: family.name,
        }
      : undefined,
    additionalProperty: additionalProperty.length
      ? additionalProperty
      : undefined,
  };
}

/**
 * Relationship edges for a product, derived from data already reviewed in
 * `lib/carsystem-data.ts`.
 *
 * Only emitted for relationships that are also rendered on the page — the
 * schema must not assert a connection a reader cannot see.
 */
export function productRelationshipJsonLd({
  product,
  compatibleProducts,
  similarProducts,
  documents,
}: {
  product: CarsystemProduct;
  compatibleProducts: CarsystemProduct[];
  similarProducts: CarsystemProduct[];
  documents: { title: string; href: string }[];
}) {
  const url = absoluteUrl(`/proizvodi/${product.slug}`);
  const toRef = (item: CarsystemProduct) => ({
    "@type": "Product" as const,
    "@id": `${absoluteUrl(`/proizvodi/${item.slug}`)}#product`,
    name: item.name,
    url: absoluteUrl(`/proizvodi/${item.slug}`),
  });

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
  };

  if (compatibleProducts.length) {
    node.isRelatedTo = compatibleProducts.map(toRef);
  }
  if (similarProducts.length) {
    node.isSimilarTo = similarProducts.map(toRef);
  }
  if (documents.length) {
    node.subjectOf = documents.map((document) => ({
      "@type": "DigitalDocument",
      name: document.title,
      url: absoluteUrl(document.href),
      encodingFormat: "application/pdf",
      inLanguage: siteConfig.language,
    }));
  }

  const hasEdges = Boolean(
    node.isRelatedTo || node.isSimilarTo || node.subjectOf,
  );
  return hasEdges ? node : undefined;
}

export function localBusinessJsonLd(stores: PartnerStore[]) {
  const verifiedStores = stores.filter(
    (store) => isPubliclyListedStore(store),
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
