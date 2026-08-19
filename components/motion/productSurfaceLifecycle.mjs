/**
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
 *
 * Plain JS (not TS) for the same reason as `lib/productTaxonomy.mjs`: the
 * lifecycle contract is exercised by `node --test` against a recording DOM
 * double, so there must be exactly one implementation. `productSurfaceLifecycle.ts`
 * is the typed wrapper.
 */

const hubs = new WeakMap();

function browserEnvironment() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  return {
    document,
    window,
    createObserver: (callback) => new MutationObserver(callback),
  };
}

function createHub(env) {
  const entries = new Map();
  const active = new Set();
  const byPointerId = new Map();

  function releasePointer(event) {
    const entry = byPointerId.get(event.pointerId);
    if (!entry) return;
    entry.handlers.onTouchPointerRelease();
  }

  function handlePointerCancel(event) {
    if (event.pointerType === "touch") {
      releasePointer(event);
      return;
    }
    for (const entry of [...active]) entry.handlers.onPointerCancel();
  }

  function handleScroll() {
    for (const entry of [...active]) entry.handlers.onScroll();
  }

  function forceCleanup() {
    for (const entry of [...active]) entry.handlers.onForceCleanup();
    for (const entry of [...byPointerId.values()]) entry.handlers.onForceCleanup();
  }

  function handleVisibilityChange() {
    if (env.document.visibilityState === "hidden") forceCleanup();
  }

  function handleWindowFocus() {
    const focused = env.document.activeElement;
    if (!focused) return;
    for (const entry of entries.values()) {
      if (entry.root.contains(focused)) {
        entry.handlers.onWindowFocus();
        return;
      }
    }
  }

  const observer = env.createObserver((records) => {
    const seen = new Set();
    for (const record of records) {
      const entry = entries.get(record.target);
      if (!entry || seen.has(entry)) continue;
      seen.add(entry);
      entry.handlers.onPointerActiveChange();
    }
  });

  env.document.addEventListener("pointerup", releasePointer, {
    passive: true,
  });
  env.document.addEventListener("pointercancel", handlePointerCancel, {
    passive: true,
  });
  env.document.addEventListener(
    "lostpointercapture",
    handlePointerCancel,
    true,
  );
  env.document.addEventListener("scroll", handleScroll, true);
  env.document.addEventListener("visibilitychange", handleVisibilityChange);
  env.window.addEventListener("blur", forceCleanup);
  env.window.addEventListener("focus", handleWindowFocus);
  env.window.addEventListener("pagehide", forceCleanup);

  return {
    env,
    entries,
    active,
    byPointerId,
    observer,
    teardown() {
      env.document.removeEventListener("pointerup", releasePointer);
      env.document.removeEventListener(
        "pointercancel",
        handlePointerCancel,
      );
      env.document.removeEventListener(
        "lostpointercapture",
        handlePointerCancel,
        true,
      );
      env.document.removeEventListener("scroll", handleScroll, true);
      env.document.removeEventListener("visibilitychange", handleVisibilityChange);
      env.window.removeEventListener("blur", forceCleanup);
      env.window.removeEventListener("focus", handleWindowFocus);
      env.window.removeEventListener("pagehide", forceCleanup);
      observer.disconnect();
      entries.clear();
      active.clear();
      byPointerId.clear();
    },
  };
}

/**
 * Registers a surface. Returns `null` during SSR, where there is nothing to
 * subscribe to; callers treat that as "no global lifecycle needed".
 *
 * Registering the same root twice replaces the previous entry rather than
 * stacking one — React Strict Mode runs effects twice, and a duplicate entry
 * would double every dispatched callback.
 */
export function registerProductSurface(root, handlers, environment) {
  const env = environment ?? browserEnvironment();
  if (!env) return null;

  let hub = hubs.get(env.document);
  if (!hub) {
    hub = createHub(env);
    hubs.set(env.document, hub);
  }
  const activeHub = hub;

  const previous = activeHub.entries.get(root);
  if (previous) {
    activeHub.active.delete(previous);
    for (const [pointerId, entry] of activeHub.byPointerId) {
      if (entry === previous) activeHub.byPointerId.delete(pointerId);
    }
  }

  const entry = { root, handlers, active: false, touchPointerId: null };
  activeHub.entries.set(root, entry);
  activeHub.observer?.observe(root, {
    attributes: true,
    attributeFilter: ["data-pointer-active"],
  });

  let released = false;

  return {
    setActive(active) {
      if (released || entry.active === active) return;
      entry.active = active;
      if (active) activeHub.active.add(entry);
      else activeHub.active.delete(entry);
    },
    setTouchPointerId(pointerId) {
      if (released) return;
      if (entry.touchPointerId !== null) {
        activeHub.byPointerId.delete(entry.touchPointerId);
      }
      entry.touchPointerId = pointerId;
      if (pointerId !== null) activeHub.byPointerId.set(pointerId, entry);
    },
    release() {
      if (released) return;
      released = true;
      if (activeHub.entries.get(root) !== entry) return;
      activeHub.entries.delete(root);
      activeHub.active.delete(entry);
      if (entry.touchPointerId !== null) {
        activeHub.byPointerId.delete(entry.touchPointerId);
      }
      if (activeHub.entries.size === 0) {
        activeHub.teardown();
        hubs.delete(env.document);
      }
    },
  };
}

/** Test-only view of the hub's live state. */
export function getProductSurfaceLifecycleStats(environment) {
  const hub = hubs.get(environment.document);
  return {
    surfaces: hub?.entries.size ?? 0,
    active: hub?.active.size ?? 0,
    capturedPointers: hub?.byPointerId.size ?? 0,
    installed: Boolean(hub),
  };
}
