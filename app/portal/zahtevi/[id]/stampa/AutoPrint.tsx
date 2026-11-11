"use client";

import { useEffect } from "react";

/** `?stampaj=1` (dugme iz maila) → dijalog štampe se otvara sam, štampa se samo list porudžbine. */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [enabled]);
  return null;
}
