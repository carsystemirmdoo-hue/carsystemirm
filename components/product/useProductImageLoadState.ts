"use client";

import { useCallback, useLayoutEffect, useState } from "react";

export type ProductImageLoadState = "loading" | "loaded" | "error";

/**
 * Load state of ONE product `<img>`, observed from outside.
 *
 * Why not Next's `onLoad`/`onError`: `next/image` re-assigns `img.src` inside its
 * own error handler, and its `onLoad` also fires for a broken image that is
 * already `complete`. The DOM element is the only reliable witness, so the
 * state is read from `complete` + `naturalWidth` and the native events, and
 * `decode()` is awaited so "loaded" means "a frame can be painted", not merely
 * "bytes arrived".
 *
 * Used by the dark theme: a photo on a flat studio backdrop gets a plate in the
 * backdrop's colour, and that plate must not stand alone as an empty white box
 * while the image is still loading or after it failed.
 *
 * Returns a callback ref (so a re-mounted `<img>` — new variant, new gallery
 * image — is observed afresh) and the state for the CURRENT `src`.
 */
export function useProductImageLoadState(src: string | null | undefined) {
  const [entry, setEntry] = useState<{ src: string | null; state: ProductImageLoadState }>({
    src: src ?? null,
    state: "loading",
  });
  const [node, setNode] = useState<HTMLImageElement | null>(null);

  const ref = useCallback((element: HTMLImageElement | null) => {
    setNode(element);
  }, []);

  useLayoutEffect(() => {
    const current = src ?? null;
    if (!node || !current) return;

    let cancelled = false;
    const settle = (state: ProductImageLoadState) => {
      if (!cancelled) setEntry({ src: current, state });
    };
    const onLoad = () => {
      if (node.naturalWidth === 0) {
        settle("error");
        return;
      }
      const decoded = typeof node.decode === "function" ? node.decode() : Promise.resolve();
      decoded.then(
        () => settle("loaded"),
        // A decode rejection after a successful load still leaves a paintable image.
        () => settle(node.naturalWidth > 0 ? "loaded" : "error"),
      );
    };
    const onError = () => settle("error");

    node.addEventListener("load", onLoad);
    node.addEventListener("error", onError);
    if (node.complete) {
      if (node.naturalWidth > 0) onLoad();
      else if (node.currentSrc) onError();
    }

    return () => {
      cancelled = true;
      node.removeEventListener("load", onLoad);
      node.removeEventListener("error", onError);
    };
  }, [node, src]);

  const state: ProductImageLoadState = entry.src === (src ?? null) ? entry.state : "loading";
  return { ref, state };
}
