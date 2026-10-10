"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/kupac", label: "Pregled", exact: true },
  { href: "/kupac/fakture", label: "Fakture" },
  { href: "/kupac/naruci", label: "Izbor robe", ordering: true },
  { href: "/kupac/korpa", label: "Korpa", ordering: true },
  { href: "/kupac/porudzbine", label: "Zahtevi i porudžbine", awaiting: true },
  { href: "/kupac/upiti", label: "Upiti" },
  { href: "/kupac/saglasnosti", label: "Saglasnosti" },
  { href: "/kupac/bezbednost", label: "Bezbednost" },
];

/**
 * Meni naloga. `ordering` — zahtev za porudžbinu uključen za ovu firmu; inače se
 * izbor robe i korpa ne nude. `awaiting` — broj važećih zahteva koji čekaju kupca.
 *
 * Na uskom ekranu meni se pomera vodoravno: aktivna stavka se dovodi u vidno
 * polje, a senka na ivici pokazuje da ima još stavki.
 */
export function AccountTabs({ ordering, awaiting = 0 }: { ordering: boolean; awaiting?: number }) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<"none" | "start" | "end" | "both">("none");

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && (active.offsetLeft < el.scrollLeft || active.offsetLeft + active.offsetWidth > el.scrollLeft + el.clientWidth)) {
      el.scrollLeft = Math.max(0, active.offsetLeft - 16);
    }
    const measure = () => {
      const more = el.scrollWidth > el.clientWidth + 2;
      const atStart = el.scrollLeft <= 2;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      setOverflow(!more ? "none" : atStart ? "end" : atEnd ? "start" : "both");
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [pathname]);

  return (
    <nav className="pn-tabs" aria-label="Moj nalog" data-overflow={overflow}>
      <div className="pn-tabs-scroll" ref={scroller}>
        {TABS.filter((t) => ordering || !("ordering" in t)).map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
              {t.label}
              {"awaiting" in t && awaiting > 0 ? (
                <>
                  <span className="pn-count" aria-hidden="true">
                    {awaiting}
                  </span>
                  <span className="pn-sr">, čeka Vas: {awaiting}</span>
                </>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
