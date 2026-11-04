"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Na javnom sajtu korpa se otvara kao bočni panel; u nalogu kupca (/kupac/*)
 * vodi na stranu korpe sa tabelom stavki. Standardna veza ostaje fallback bez
 * JS-a i za otvaranje u novoj kartici.
 */
export function CustomerCartLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const inAccount = (usePathname() ?? "").startsWith("/kupac");
  if (inAccount) return <Link {...props} onClick={onClick} />;
  return <Link {...props} prefetch={false} data-route-transition-skip onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    // Mobilni meni prvo oslobađa fokus i zaključavanje skrola.
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("cs-open-cart")));
  }} />;
}
