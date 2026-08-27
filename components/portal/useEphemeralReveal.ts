"use client";

import { useEffect } from "react";

/**
 * Briše jednokratnu tajnu iz stanja komponente kada strana napusti ekran.
 *
 * Problem koji rešava
 * -------------------
 * Rezervni kodovi, kod za promenu lozinke i dozvola za vezivanje prikazuju se
 * tačno jednom. Zaglavlje `no-store` sprečava da odgovor završi u kešu, ali NE
 * pokriva „back/forward cache": pretraživač tu čuva celu **živu** stranu u
 * memoriji — sa React stanjem i svim što je u njemu — i vraća je netaknutu kada
 * korisnik pritisne „Nazad". Kodovi bi se tako ponovo pojavili na ekranu,
 * moguće pred nekim drugim.
 *
 * Kako se rešava
 * --------------
 * `pagehide` se javlja i pri običnom napuštanju strane i pri ulasku u bfcache
 * (tada sa `persisted === true`) — tu se stanje briše. `pageshow` sa
 * `persisted === true` znači da je strana ipak vraćena iz bfcache-a; briše se i
 * tada, jer neki pretraživači ne isporuče `pagehide` pouzdano.
 *
 * `visibilitychange` se namerno NE koristi: prelazak na drugi tab ne znači da
 * je korisnik završio, a brisanje tada bi mu progutalo kodove usred prepisivanja.
 *
 * @param clear briše tajnu iz stanja; mora biti stabilan (`useCallback`)
 * @param active da li tajna trenutno postoji na ekranu
 */
export function useEphemeralReveal(clear: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;

    const onPageHide = () => clear();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [clear, active]);
}
