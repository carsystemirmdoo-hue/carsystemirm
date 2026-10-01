"use client";

import { useEffect, useState } from "react";
import type { CatalogOffer } from "@/lib/ordering/ordering-service";
import { ensureCustomerSession, hasCustomerMarker } from "./customerSession";

export type OffersPayload = {
  signedIn: true;
  company: string;
  demo: boolean;
  ordering: { enabled: true; priceList: { name: string; kind: "demo" | "biznisoft"; currency: string } } | { enabled: false; reason: string };
  offers: CatalogOffer[];
  contacts: { reps: { name: string; email: string }[]; office: { phone: string | null; phoneHref: string | null; email: string } };
};

/*
 * Jedan zahtev po strani, deljen između svih kartica i panela. Bez markera
 * prijave (`cs_kupac`) se ništa ne traži: anonimni posetilac ne pravi nijedan
 * dodatan zahtev, a javne strane ostaju statične.
 */
let shared: Promise<OffersPayload | null> | null = null;

function load(): Promise<OffersPayload | null> {
  if (!hasCustomerMarker()) return Promise.resolve(null);
  shared ??= ensureCustomerSession()
    .then((s) => (s?.signedIn ? fetch("/api/kupac/ponude", { cache: "no-store", credentials: "same-origin" }) : null))
    .then((r) => (r && r.ok ? r.json() : null))
    .then((body) => (body?.signedIn ? (body as OffersPayload) : null))
    .catch(() => null);
  return shared;
}

/** `undefined` dok se učitava, `null` bez kupčeve prijave. */
export function useCustomerOffers(): OffersPayload | null | undefined {
  const [state, setState] = useState<OffersPayload | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setState(v));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
