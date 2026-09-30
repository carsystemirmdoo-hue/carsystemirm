"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  watchProductImageLoad,
  type ProductImageLoadState,
} from "@/components/product/productImageLoadState.mjs";

export type { ProductImageLoadState };

/**
 * React adapter for the ONE product image load-state implementation
 * (`productImageLoadState.mjs` → `watchProductImageLoad`): `loading` →
 * `loaded` | `failed`, where `loaded` means decoded ("a frame can be painted"),
 * stale events are ignored and an already-decoded source settles synchronously.
 *
 * The state is keyed by `src`: a different image on the same instance starts
 * from `loading` without an extra effect pass. The watcher runs in a LAYOUT
 * effect, so an image decoded earlier in the session (a card re-mounted after
 * a search) is `loaded` before the first paint — no frame without its shadow.
 *
 * Returns a callback ref (so a re-mounted `<img>` — new variant, new gallery
 * image — is observed afresh) and the state for the CURRENT `src`.
 */
export function useProductImageLoadState(src: string | null | undefined) {
  const [entry, setEntry] = useState<{
    src: string | null;
    state: ProductImageLoadState;
  }>({ src: src ?? null, state: "loading" });
  const [node, setNode] = useState<HTMLImageElement | null>(null);

  const ref = useCallback((element: HTMLImageElement | null) => {
    setNode(element);
  }, []);

  useLayoutEffect(() => {
    const current = src ?? null;
    if (!node || !current) return undefined;
    return watchProductImageLoad(node, (state) => {
      setEntry((previous) =>
        previous.src === current && previous.state === state
          ? previous
          : { src: current, state },
      );
    });
  }, [node, src]);

  const state: ProductImageLoadState =
    entry.src === (src ?? null) ? entry.state : "loading";
  return { ref, state };
}
