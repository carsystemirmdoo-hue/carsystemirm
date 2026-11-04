"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/** Standardna veza ostaje fallback bez JS-a i za otvaranje u novoj kartici. */
export function CustomerCartLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} data-route-transition-skip onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    // Mobilni meni prvo oslobađa fokus i zaključavanje skrola.
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("cs-open-cart")));
  }} />;
}
