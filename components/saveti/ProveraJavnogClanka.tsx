"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/*
 * Povučen članak ne sme da ostane dostupan kroz navigaciju unutar sajta.
 *
 * Server povučen članak više ne služi (strana i slika vraćaju 404 čim se povuče), ali Next.js
 * u pregledaču čuva već učitane strane i do 5 minuta ih prikazuje pri kliku na vezu, nazad ili
 * napred, bez pitanja servera. Zato strana članka pri svakom prikazu proveri svoju adresu kratkim
 * HEAD zahtevom (ide kroz isti keš strane kao i obična poseta, bez keša pregledača). Ako članak
 * više nije javan, strana se osveži sa servera i posetilac vidi „Stranica nije pronađena“.
 * Keš ostalih strana sajta se ne menja.
 */
export function ProveraJavnogClanka({ route }: { route: string }) {
  const router = useRouter();
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(route, { method: "HEAD", cache: "no-store", signal: ctrl.signal })
      .then((response) => {
        if (response.status === 404 || response.status === 410) router.refresh();
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [route, router]);
  return null;
}
