import { redirect } from "next/navigation";
import { CALLBACK_PARAM, LOGIN_ROUTE, normalizeCallback } from "@/lib/authz/redirects.mjs";

export const dynamic = "force-dynamic";

/**
 * Prijava je premeštena na `/prijava`. Ova ruta ostaje da stare veze i sačuvane
 * kartice nastave da rade, uz očuvan `callbackUrl`.
 */
export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params[CALLBACK_PARAM] ?? params.nastavak;
  const callback = normalizeCallback(Array.isArray(raw) ? raw[0] : raw);

  redirect(
    callback
      ? `${LOGIN_ROUTE}?${CALLBACK_PARAM}=${encodeURIComponent(callback)}`
      : LOGIN_ROUTE,
  );
}
