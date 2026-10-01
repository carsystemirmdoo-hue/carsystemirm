"use client";

/*
 * Jedan zajednički poziv stanja prijave po strani.
 *
 * `/api/kupac/sesija` sa zapamćenog uređaja OBNAVLJA isteklu sesiju, pa ostali
 * pozivi (ponude, „Poručite ponovo") moraju da sačekaju njega — inače bi
 * dobili 401 pre nego što nova sesija postoji. Bez markera (`cs_kupac`) se
 * ništa ne traži.
 */
export type CustomerSessionState =
  | { signedIn: true; company: string; name: string; cartCount?: number }
  | { signedIn: false; loginLink: boolean };

let shared: Promise<CustomerSessionState | null> | null = null;

export function hasCustomerMarker() {
  return typeof document !== "undefined" && /(?:^|;\s*)cs_kupac=1/.test(document.cookie);
}

export function ensureCustomerSession(): Promise<CustomerSessionState | null> {
  if (!hasCustomerMarker()) return Promise.resolve(null);
  shared ??= fetch("/api/kupac/sesija", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return shared;
}
