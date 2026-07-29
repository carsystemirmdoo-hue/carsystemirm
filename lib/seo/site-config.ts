const FALLBACK_PRODUCTION_URL = "https://carsystemirm.com";

function normalizeSiteUrl(value: string | undefined) {
  if (!value) return FALLBACK_PRODUCTION_URL;

  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_PRODUCTION_URL;
  }
}

const vercelEnvironment = process.env.VERCEL_ENV;
const indexingExplicitlyDisabled =
  process.env.NEXT_PUBLIC_SEO_INDEXING === "false";
const isPreviewDeployment =
  vercelEnvironment === "preview" || vercelEnvironment === "development";

export const seoSiteConfig = {
  name: "Carsystem i R-M Inđija",
  shortName: "Carsystem i R-M",
  legalName: "Carsystem i R-M Inđija",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  locale: "sr_RS",
  language: "sr-Latn",
  applicationName: "Carsystem i R-M",
  defaultTitle: "Carsystem i R-M | Auto lakovi, boje i oprema",
  titleSuffix: "Carsystem i R-M",
  defaultDescription:
    "Profesionalni auto lakovi, boje, materijali i oprema za autolakirnice, uz tehničku podršku i partnersku mrežu u Srbiji.",
  defaultOgImage: "/images/home/hero-dark.png",
  logo: "/carsystem-logo-outline.svg",
  indexingEnabled: !indexingExplicitlyDisabled && !isPreviewDeployment,
  deploymentEnvironment: vercelEnvironment ?? "local",
} as const;

export function absoluteSeoUrl(pathname = "/") {
  return new URL(pathname, `${seoSiteConfig.url}/`).toString();
}
