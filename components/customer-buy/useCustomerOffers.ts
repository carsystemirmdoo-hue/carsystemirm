"use client";

import { useEffect, useState } from "react";
import type { CatalogRequestOffer } from "@/lib/ordering/request-service";
import { ensureCustomerSession, hasCustomerMarker } from "./customerSession";

export type OffersPayload = {
  signedIn: true;
  company: string;
  ordering: { enabled: true } | { enabled: false; reason: string | null };
  /** Odobrene opcije plaćanja kupca (bez odobrene: jedna „osnovni“). */
  options: { code: string | null; key: string; label: string; note: string | null }[];
  offers: CatalogRequestOffer[];
  contacts: { reps: { name: string; email: string }[]; office: {
      phone: string | null;
      phoneHref: string | null;
      email: string;
      emailHref: string;
      workingHours: string | null;
    };
  };
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

/** BizniSoft JM za kupca: LIT → „L“, KOM → „kom“. */
export function unitLabel(unit: string | null | undefined) {
  const u = String(unit ?? "").toUpperCase();
  return u === "LIT" ? "L" : u === "KOM" ? "kom" : u === "KG" ? "kg" : u.toLowerCase() || "JM";
}

/** Prikaz cene sa PDV-om (zaokruženo na paru); obračun zahteva radi server. */
export function withVat(net: number, vatPercent: number) {
  return Math.round(net * (100 + vatPercent)) / 100;
}
