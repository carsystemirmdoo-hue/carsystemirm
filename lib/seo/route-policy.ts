export type SeoRouteType =
  | "home"
  | "catalog"
  | "category"
  | "brand"
  | "program"
  | "product"
  | "store"
  | "contact"
  | "legal"
  | "search"
  | "filtered-catalog"
  | "preview"
  | "demo"
  | "draft"
  | "not-found";

export type SeoRoutePolicy = {
  index: boolean;
  follow: boolean;
  sitemap: boolean;
  canonical: "self" | "base-route" | "none";
  structuredData:
    | "WebPage"
    | "CollectionPage"
    | "Brand"
    | "Product"
    | "LocalBusiness"
    | "BreadcrumbList"
    | "none";
};

export const seoRoutePolicies: Record<SeoRouteType, SeoRoutePolicy> = {
  home: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "WebPage",
  },
  catalog: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "CollectionPage",
  },
  category: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "CollectionPage",
  },
  brand: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "Brand",
  },
  program: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "CollectionPage",
  },
  product: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "Product",
  },
  store: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "LocalBusiness",
  },
  contact: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "BreadcrumbList",
  },
  legal: {
    index: true,
    follow: true,
    sitemap: true,
    canonical: "self",
    structuredData: "WebPage",
  },
  search: {
    index: false,
    follow: true,
    sitemap: false,
    canonical: "base-route",
    structuredData: "none",
  },
  "filtered-catalog": {
    index: false,
    follow: true,
    sitemap: false,
    canonical: "base-route",
    structuredData: "none",
  },
  preview: {
    index: false,
    follow: false,
    sitemap: false,
    canonical: "none",
    structuredData: "none",
  },
  demo: {
    index: false,
    follow: false,
    sitemap: false,
    canonical: "none",
    structuredData: "none",
  },
  draft: {
    index: false,
    follow: false,
    sitemap: false,
    canonical: "none",
    structuredData: "none",
  },
  "not-found": {
    index: false,
    follow: true,
    sitemap: false,
    canonical: "none",
    structuredData: "none",
  },
};
