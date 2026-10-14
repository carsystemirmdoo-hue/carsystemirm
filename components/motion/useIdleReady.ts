"use client";

import { useEffect, useState } from "react";

/**
 * `true` tek kada se stranica učita i pregledač bude besposlen (ili posle `timeout` ms).
 *
 * Karuseli kampanja drže sve slajdove u DOM-u, jedan preko drugog, pa `loading="lazy"` ne
 * odlaže ništa — svaki slajd je „u prozoru”. Slike slajdova koji se ne vide čekaju ovaj
 * signal, da prva slika i tekst stranice ne dele mrežu sa tri velike fotografije.
 */
export function useIdleReady(timeout = 2500) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    let idleId: number | undefined;
    let timer: number | undefined;
    const done = () => setReady(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(done, { timeout });
      } else {
        timer = globalThis.setTimeout(done, timeout) as unknown as number;
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      if (timer !== undefined) globalThis.clearTimeout(timer);
    };
  }, [ready, timeout]);
  return ready;
}
