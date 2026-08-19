/**
 * Typed wrapper over the shared product-surface lifecycle.
 *
 * The implementation lives in `productSurfaceLifecycle.mjs` so the catalog, the
 * PDP and `node --test` all execute the same hub. This file only adds types; it
 * must not add a second lifecycle.
 *
 * Shared global lifecycle for every `ProductVisualSurface` on a document.
 *
 * Each surface used to install its own eight global listeners and its own
 * `MutationObserver`, so a 96-card catalog page carried 768 global listeners and
 * 96 observers — and every scroll frame ran 96 handlers even when nothing was
 * hovered. The hub installs one listener per event and one observer for the
 * whole document, and routes each event only to the surfaces that can act on it:
 *
 *   pointerup / touch pointercancel -> the one surface holding that pointer id
 *   pointercancel / scroll / blur / pagehide / visibilitychange -> active only
 *   focus                           -> the surface containing document.activeElement
 *   data-pointer-active mutation    -> the surface that owns the mutated node
 *
 * With nothing active a global event therefore does no per-surface work at all.
 *
 * Ownership: the hub is created on first registration and fully torn down —
 * listeners removed, observer disconnected, maps emptied — when the last
 * registration is released. No state survives a document with zero surfaces,
 * which is what keeps Strict Mode double-mount and HMR remounts from stacking
 * duplicate listeners.
 */

export type ProductSurfaceHandlers = {
  /** A pointer this surface captured was released or cancelled elsewhere. */
  onTouchPointerRelease: () => void;
  /** Non-touch pointer cancel / lost capture while this surface was active. */
  onPointerCancel: () => void;
  onScroll: () => void;
  /** Window blur, pagehide, or the tab becoming hidden. */
  onForceCleanup: () => void;
  /** Window regained focus and this surface contains the focused element. */
  onWindowFocus: () => void;
  /** This surface's `data-pointer-active` attribute changed. */
  onPointerActiveChange: () => void;
};

export type ProductSurfaceRegistration = {
  /** Active = hovered, pressed or focused; drives which surfaces get events. */
  setActive: (active: boolean) => void;
  /** Pointer id this surface captured for a touch interaction, or null. */
  setTouchPointerId: (pointerId: number | null) => void;
  release: () => void;
};

/**
 * The DOM surface the hub talks to. Injectable so the lifecycle contract can be
 * exercised against a recording double in `node --test`, where there is no DOM.
 */
export type ProductSurfaceEnvironment = {
  document: Pick<
    Document,
    "addEventListener" | "removeEventListener" | "visibilityState"
  > & { activeElement: Element | null };
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  createObserver: (callback: MutationCallback) => {
    observe: (target: Node, options?: MutationObserverInit) => void;
    disconnect: () => void;
  };
};

import {
  getProductSurfaceLifecycleStats as getStatsImpl,
  registerProductSurface as registerImpl,
} from "./productSurfaceLifecycle.mjs";

export function registerProductSurface(
  root: Element,
  handlers: ProductSurfaceHandlers,
  environment?: ProductSurfaceEnvironment,
): ProductSurfaceRegistration | null {
  return registerImpl(root, handlers, environment) as ProductSurfaceRegistration | null;
}

/** Test-only view of the hub's live state. */
export function getProductSurfaceLifecycleStats(
  environment: ProductSurfaceEnvironment,
): { surfaces: number; active: number; capturedPointers: number; installed: boolean } {
  return getStatsImpl(environment) as {
    surfaces: number;
    active: number;
    capturedPointers: number;
    installed: boolean;
  };
}
