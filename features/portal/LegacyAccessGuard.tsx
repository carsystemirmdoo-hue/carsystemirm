"use client";

import type { ReactNode } from "react";
import type { Permission } from "@/types/portal";
import { can } from "@/permissions/portal-permissions";
import { StateView } from "@/components/portal/PortalPrimitives";
import { usePortal } from "@/components/portal/PortalProvider";

/**
 * Kapija po STAROM modelu dozvola — isključivo za module iz ranije verzije.
 *
 * Zašto stoji ovde, a ne uz ostale primitive
 * ------------------------------------------
 * Repozitorijum je do sada imao dva modela dozvola: živi
 * (`lib/authz/permissions.mjs`, uloge `gazda | komercijalista | kancelarija |
 * magacioner`) i stari (`permissions/portal-permissions.ts`, uloge
 * `owner | sales | office`). Ovaj drugi ne poznaje nijednu stvarnu ulogu iz
 * baze, pa bi svaka provera kroz njega dala pogrešan odgovor.
 *
 * Dok je ova komponenta živela u `PortalPrimitives.tsx`, stari model je bio
 * dohvatljiv iz sloja koji uvoze i žive strane — dovoljno da ga neko upotrebi
 * misleći da je to prava kapija. Premeštanjem ovde granica postaje vidljiva iz
 * same putanje: `features/portal/` su moduli ranije verzije, nevezani ni za
 * jednu rutu (vidi `fixtures/dev/README.md`).
 *
 * Ovo NIJE bezbednosna kapija ni u starom ni u novom modelu. Prava kapija je
 * `requireCapability()` na serveru (`lib/authz/session.ts`); skrivanje sadržaja
 * u pretraživaču je oduvek bilo samo prikaz.
 */
export function AccessGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { role } = usePortal();
  if (!can(role, permission)) return <StateView state="permission" />;
  return <>{children}</>;
}
