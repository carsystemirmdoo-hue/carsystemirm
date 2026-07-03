import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_HEADER = 'Basic realm="Carsystem RM Preview"';
const MAINTENANCE_ROUTE = "/site-u-pripremi";

const PUBLIC_FILE_PATTERN = /\.(?:avif|css|gif|ico|jpg|jpeg|js|map|pdf|png|svg|txt|webp|xml)$/i;

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": AUTH_HEADER,
      "Cache-Control": "no-store",
    },
  });
}

function parseBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(header.slice("Basic ".length).trim());
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function isEnabled(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.toLowerCase() ?? "");
}

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

function requirePreviewAuth(request: NextRequest) {
  const expectedUsername = process.env.PREVIEW_USERNAME;
  const expectedPassword = process.env.PREVIEW_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return unauthorized();
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));

  if (
    credentials?.username === expectedUsername &&
    credentials.password === expectedPassword
  ) {
    return NextResponse.next();
  }

  return unauthorized();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPreviewRoute(pathname)) {
    return requirePreviewAuth(request);
  }

  if (isBypassedRoute(pathname)) {
    return NextResponse.next();
  }

  if (isMaintenanceEnabled()) {
    const url = request.nextUrl.clone();
    url.pathname = MAINTENANCE_ROUTE;
    url.search = "";

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
