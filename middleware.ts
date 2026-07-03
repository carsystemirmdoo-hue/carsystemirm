import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isEnabled,
  isValidSiteAccessToken,
  SITE_ACCESS_COOKIE_NAME,
} from "./lib/site-access";

const MAINTENANCE_ROUTE = "/site-u-pripremi";
const SITE_ACCESS_ROUTE = "/site-u-pripremi/access";

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
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const maintenanceEnabled = isMaintenanceEnabled();
  const hasAccess = await hasSiteAccess(request);

  if (isPreviewRoute(pathname)) {
    return redirectTo(request, maintenanceEnabled && !hasAccess ? MAINTENANCE_ROUTE : "/");
  }

  if (pathname === MAINTENANCE_ROUTE && maintenanceEnabled && hasAccess) {
    return redirectTo(request, "/");
  }

  if (isBypassedRoute(pathname)) {
    return NextResponse.next();
  }

  if (maintenanceEnabled && !hasAccess) {
    return redirectTo(request, MAINTENANCE_ROUTE);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
