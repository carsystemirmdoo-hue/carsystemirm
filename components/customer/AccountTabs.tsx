"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/kupac", label: "Pregled", exact: true },
  { href: "/kupac/fakture", label: "Fakture" },
  { href: "/kupac/porudzbine", label: "Porudžbine" },
  { href: "/kupac/saglasnosti", label: "Saglasnosti" },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav className="ka-tabs" aria-label="Moj nalog">
      {TABS.map((t) => {
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
