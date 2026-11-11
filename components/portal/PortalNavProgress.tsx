"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * „Učitava se…“ za portal (2026-11-11): traka na vrhu i natpis čim korisnik klikne na link,
 * pošalje GET formu (filteri, pretraga) ili ekran pozove `portalNavStart()` pre `router.push`.
 * Nestaje kad se adresa promeni. Ako se adresa ne promeni (ista strana, greška), nestaje posle
 * 20 s — nikad ne ostaje zauvek.
 *
 * Serverske akcije (dugmad „Sačuvaj“, „Osveži“) imaju sopstveni natpis na dugmetu.
 */

const EVENT = "portal:nav-start";

/** Pozvati pre `router.push`/`router.replace` u ekranima portala. */
export function portalNavStart() {
  window.dispatchEvent(new Event(EVENT));
}

function isInternalNav(a: HTMLAnchorElement, e: MouseEvent) {
  // `defaultPrevented` se NE proverava: next/link sam zaustavlja klik da bi vodio bez punog učitavanja.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  const here = new URL(window.location.href);
  // Isti dokument, samo sidro (#) — nema učitavanja.
  if (url.pathname === here.pathname && url.search === here.search) return false;
  return true;
}

export function PortalNavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    const start = () => {
      clear();
      setBusy(true);
      setSlow(false);
      timers.current.push(window.setTimeout(() => setSlow(true), 1200));
      timers.current.push(window.setTimeout(() => setBusy(false), 20000));
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && isInternalNav(a, e)) start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // Samo GET forme menjaju adresu; POST (serverske akcije) imaju svoj natpis.
      if (!e.defaultPrevented && (form.method || "get").toLowerCase() === "get" && !form.target) start();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener(EVENT, start);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener(EVENT, start);
    };
  }, []);

  // Nova adresa je stigla → gotovo.
  useEffect(() => {
    clear();
    setBusy(false);
    setSlow(false);
  }, [pathname, search]);

  useEffect(() => clear, []);

  return (
    <div className="portal-navload" data-busy={busy ? "true" : undefined} aria-hidden={!busy}>
      <span className="portal-navload-bar" />
      <span className="portal-navload-note" role="status" aria-live="polite">
        {busy ? (slow ? "Učitavam podatke… ovo može potrajati nekoliko sekundi" : "Učitavam…") : ""}
      </span>
    </div>
  );
}
