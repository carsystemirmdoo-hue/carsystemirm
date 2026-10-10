"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Okvir tabele koja može biti šira od prostora: pomera se samo tabela, ne strana.
 * Kad ima skrivenih kolona, ispod naslova piše da se tabela pomera, a ivica ima
 * senku. Okvir je fokusabilan (strelice levo/desno rade sa tastature).
 */
export function ScrollTable({ label, children }: { label: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => {
      const table = el.firstElementChild as HTMLElement | null;
      setWide((table?.scrollWidth ?? el.scrollWidth) > el.clientWidth + 2);
      setReady(true);
    };
    check();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <>
      <p className="pn-scroll-hint" data-visible={wide ? "true" : undefined}>
        Tabela je šira od ekrana — pomerite je vodoravno da vidite sve kolone.
      </p>
      {/* `data-fit`: tabela staje u širinu — tada je okvir bez sopstvenog pomeranja, pa zaglavlje tabele može da ostane vidljivo pri pomeranju strane. */}
      <div ref={box} className="pn-scroll" role="region" aria-label={label} tabIndex={wide ? 0 : -1} data-fit={ready && !wide ? "true" : undefined}>
        {children}
      </div>
    </>
  );
}
