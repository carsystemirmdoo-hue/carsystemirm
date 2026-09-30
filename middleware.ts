import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import {
  CALLBACK_PARAM,
  CUSTOMER_HOME_ROUTE,
  CUSTOMER_LOGIN_ROUTE,
  normalizeCustomerReturn,
  LOGIN_ROUTE,
  loginUrlFor,
  normalizeCallback,
} from "./lib/authz/redirects.mjs";
import {
  isEnabled,
  isValidSiteAccessToken,
  SITE_ACCESS_COOKIE_NAME,
} from "./lib/site-access";
import { seoSiteConfig } from "./lib/seo/site-config";

const MAINTENANCE_ROUTE = "/site-u-pripremi";
const SITE_ACCESS_ROUTE = "/site-u-pripremi/access";


// Edge-bezbedna instanca: dekodira token sesije bez dodirivanja baze.
// Ovo je samo preusmeravanje radi udobnosti — dozvole se proveravaju na serveru,
// u svakoj stranici i route handler-u (lib/authz/session.ts).
const { auth: withAuth } = NextAuth(authConfig);

const PUBLIC_FILE_PATTERN = /\.(?:avif|css|gif|ico|jpg|jpeg|js|map|pdf|png|svg|txt|webp|xml)$/i;

function isMaintenanceEnabled() {
  return isEnabled(process.env.MAINTENANCE_MODE);
}

function isPreviewRoute(pathname: string) {
  return pathname === "/preview" || pathname.startsWith("/preview/");
}

function isBypassedRoute(pathname: string) {
  return (
    pathname === MAINTENANCE_ROUTE ||
    pathname.startsWith(`${MAINTENANCE_ROUTE}/`) ||
    pathname === SITE_ACCESS_ROUTE ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/brands/") ||
    pathname.startsWith("/products/") ||
    pathname.startsWith("/maps/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isLoginRoute(pathname) ||
    // Portal se namerno više ne preskače ovde: pristup mu odlučuje prijava,
    // a ne režim održavanja javnog sajta. Ranije je bio dostupan svakome.
    isPortalRoute(pathname) ||
    isCustomerRoute(pathname) ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
}

function isPortalRoute(pathname: string) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

/**
 * Kupčev prostor.
 *
 * Odvojena grana od `/portal`: kupčev token nema šta da traži u internom
 * prostoru, ni interni u kupčevom. Ovde se proverava samo da postoji sesija —
 * ČIJA je i sme li da uđe odlučuje `requireCustomerSession()` na serveru, gde
 * se podaci naloga čitaju iz baze pri svakom zahtevu.
 */
function isCustomerRoute(pathname: string) {
  return (
    pathname === CUSTOMER_HOME_ROUTE ||
    pathname.startsWith(`${CUSTOMER_HOME_ROUTE}/`)
  );
}

function isPortalPublicRoute(pathname: string) {
  // Stara adresa prijave ostaje dostupna jer preusmerava na novu.
  return pathname === "/portal/prijava" || pathname.startsWith("/api/auth/");
}

/** Prijava je javna i mora zaobići i režim održavanja javnog sajta. */
function isLoginRoute(pathname: string) {
  /*
   * Cela grana `/prijava`, ne samo tačna adresa.
   *
   * `/prijava/reset` otvara čovek koji ne može da uđe. Da je pokriven režimom
   * održavanja, ostao bi zaključan napolju baš onda kada mu je oporavak
   * najpotrebniji.
   */
  return pathname === LOGIN_ROUTE || pathname.startsWith(`${LOGIN_ROUTE}/`);
}

function shouldNoindexQuery(request: NextRequest) {
  return (
    Boolean(request.nextUrl.search) &&
    (request.nextUrl.pathname === "/katalog" ||
      request.nextUrl.pathname === "/kontakt")
  );
}

function shouldNoindexInternalRoute(pathname: string) {
  return (
    pathname === MAINTENANCE_ROUTE ||
    pathname.startsWith(`${MAINTENANCE_ROUTE}/`) ||
    pathname === "/interaction-demo" ||
    pathname.startsWith("/interaction-demo/") ||
    pathname === "/social-exports" ||
    pathname.startsWith("/social-exports/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    isCustomerRoute(pathname)
  );
}

function nextResponse(request: NextRequest) {
  const response = NextResponse.next();
  if (shouldNoindexQuery(request)) {
    response.headers.set("X-Robots-Tag", "noindex, follow, noarchive");
  } else if (shouldNoindexInternalRoute(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  return NextResponse.redirect(url);
}

async function hasSiteAccess(request: NextRequest) {
  return isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE_NAME)?.value);
}

function redirectToPortalLogin(request: NextRequest) {
  // `loginUrlFor` gradi `/prijava?callbackUrl=…`. Putanja se nikada ne
  // nadovezuje na adresu prijave — to bi dalo nepostojeće `/prijava/dozvole`.
  const target = loginUrlFor(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return privateRedirect(new URL(target, request.nextUrl.origin));
}

/**
 * Preusmerenje sa privatne putanje (portal, nalog kupca, prijava) zavisi od
 * sesije pozivaoca — ne sme ga zapamtiti ni pregledač ni posrednik.
 */
function privateRedirect(url: URL) {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Vary", "Cookie");
  return res;
}

/** Obnova sesije sa zapamćenog uređaja (route handler, ne strana). */
const CUSTOMER_RESUME_ROUTE = "/prijava/kupac/nastavi";

export default withAuth(async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Stara adresa prijave se preusmerava ovde, a ne u samoj strani: layout
  // portala traži prijavljenog korisnika i preusmerio bi pre nego što strana
  // stigne da pročita `callbackUrl`.
  if (pathname === "/portal/prijava") {
    const raw =
      request.nextUrl.searchParams.get(CALLBACK_PARAM) ??
      request.nextUrl.searchParams.get("nastavak");
    const callback = normalizeCallback(raw);
    const target = callback
      ? `${LOGIN_ROUTE}?${CALLBACK_PARAM}=${encodeURIComponent(callback)}`
      : LOGIN_ROUTE;
    return privateRedirect(new URL(target, request.nextUrl.origin));
  }

  if (isPortalRoute(pathname) && !isPortalPublicRoute(pathname)) {
    if (!request.auth?.user?.id) return redirectToPortalLogin(request);
  }

  if (isCustomerRoute(pathname) && !request.auth?.user?.id) {
    // Povratak na traženu stranu naloga (npr. link na fakturu), proveren istom kapijom.
    const back = normalizeCustomerReturn(`${pathname}${request.nextUrl.search}`);
    /*
     * „Zapamti me": sa zapamćenog uređaja prvo pokušaj obnovu. Middleware ne
     * proverava token (edge nema bazu) — to radi `/prijava/kupac/nastavi`,
     * koja pri neuspehu briše kolačić, pa petlje nema.
     */
    if (
      process.env.CUSTOMER_REMEMBER_ME === "1" &&
      (request.cookies.has("cs_remember") || request.cookies.has("__Host-cs_remember"))
    ) {
      const resume = back
        ? `${CUSTOMER_RESUME_ROUTE}?${CALLBACK_PARAM}=${encodeURIComponent(back)}`
        : CUSTOMER_RESUME_ROUTE;
      return privateRedirect(new URL(resume, request.nextUrl.origin));
    }
    const target = back
      ? `${CUSTOMER_LOGIN_ROUTE}?${CALLBACK_PARAM}=${encodeURIComponent(back)}`
      : CUSTOMER_LOGIN_ROUTE;
    return privateRedirect(new URL(target, request.nextUrl.origin));
  }

  return handleSiteRouting(request);
});

async function handleSiteRouting(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProductionDeployment = process.env.VERCEL_ENV === "production";
  const canonicalHost = new URL(seoSiteConfig.url).host;
  if (
    isProductionDeployment &&
    request.nextUrl.host !== canonicalHost
  ) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = canonicalHost;
    return NextResponse.redirect(canonicalUrl, 308);
  }
  const maintenanceEnabled = isMaintenanceEnabled();
  const hasAccess = await hasSiteAccess(request);

  if (isPreviewRoute(pathname)) {
    return redirectTo(request, maintenanceEnabled && !hasAccess ? MAINTENANCE_ROUTE : "/");
  }

  if (pathname === MAINTENANCE_ROUTE && maintenanceEnabled && hasAccess) {
    return redirectTo(request, "/");
  }

  if (isBypassedRoute(pathname)) {
    return nextResponse(request);
  }

  if (maintenanceEnabled && !hasAccess) {
    return redirectTo(request, MAINTENANCE_ROUTE);
  }

  return nextResponse(request);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
