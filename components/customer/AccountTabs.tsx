"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/kupac", label: "Pregled", exact: true },
  { href: "/kupac/fakture", label: "Fakture" },
  { href: "/kupac/naruci", label: "Izbor robe", ordering: true },
  { href: "/kupac/korpa", label: "Korpa", ordering: true },
  { href: "/kupac/porudzbine", label: "Porudžbine" },
  { href: "/kupac/upiti", label: "Upiti" },
  { href: "/kupac/saglasnosti", label: "Saglasnosti" },
  { href: "/kupac/bezbednost", label: "Bezbednost" },
];

/** `ordering` — zahtev za porudžbinu uključen za ovu firmu; inače se izbor robe i korpa ne nude. */
export function AccountTabs({ ordering }: { ordering: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="ka-tabs" aria-label="Moj nalog">
      {TABS.filter((t) => ordering || !("ordering" in t)).map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
