import { NextResponse, type NextRequest } from "next/server";
import {
  createSiteAccessToken,
  getSiteAccessPassword,
  SITE_ACCESS_COOKIE_MAX_AGE,
  SITE_ACCESS_COOKIE_NAME,
} from "@/lib/site-access";

const MAINTENANCE_ROUTE = "/site-u-pripremi";

function redirectToMaintenance(request: NextRequest, status?: string) {
  const url = new URL(MAINTENANCE_ROUTE, request.url);
  if (status) url.searchParams.set("access", status);

  return NextResponse.redirect(url, 303);
}

export function GET(request: NextRequest) {
  return redirectToMaintenance(request);
}

export async function POST(request: NextRequest) {
  const expectedPassword = getSiteAccessPassword();

  if (!expectedPassword) {
    return redirectToMaintenance(request, "not-configured");
  }

  const formData = await request.formData();
  const accessCode = String(formData.get("accessCode") ?? "").trim();

  if (!accessCode) {
    return redirectToMaintenance(request, "missing");
  }

  if (accessCode !== expectedPassword) {
    return redirectToMaintenance(request, "invalid");
  }

  const accessToken = await createSiteAccessToken();

  if (!accessToken) {
    return redirectToMaintenance(request, "not-configured");
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);

  response.cookies.set({
    name: SITE_ACCESS_COOKIE_NAME,
    value: accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SITE_ACCESS_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
