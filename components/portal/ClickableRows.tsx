"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Ceo red tabele vodi na vezu iz reda (`a.rr-row-link`) — 2026-11-10.
 *
 * Razvučena veza (`::after`) ne radi ovde: prva ćelija je „lepljiva“ (sticky) za
 * vodoravni skrol na telefonu, pa bi veza pokrila samo nju. Zato se klik hvata
 * na redu. Tastatura i čitač ekrana i dalje koriste samu vezu; klik na drugu
 * vezu ili dugme u redu radi svoje; Ctrl/Cmd/srednji klik otvara novu karticu.
 */
export function ClickableRows({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, label, summary")) return;
    if (window.getSelection()?.toString()) return; // označavanje teksta nije klik
    const link = target.closest("tr")?.querySelector<HTMLAnchorElement>("a.rr-row-link");
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.button === 1) window.open(link.href, "_blank", "noopener");
    else router.push(link.getAttribute("href") ?? link.href);
  };
  return (
    // Klik na red je dodatak mišu; ista veza je u redu dostupna tastaturom (jsx-a11y ovde ne prijavljuje).
    <div className={className} onClick={onClick}>
      {children}
    </div>
  );
}
