import assert from "node:assert/strict";
import test from "node:test";

import {
  getProductSurfaceLifecycleStats,
  registerProductSurface,
} from "./productSurfaceLifecycle.mjs";

/**
 * Recording DOM double.
 *
 * It implements the real `addEventListener`/`removeEventListener`/
 * `MutationObserver` surface the hub calls, and dispatches to the handlers the
 * hub actually registered — so these tests exercise the lifecycle contract, not
 * a mock's call count. A leaked listener shows up as a non-empty registry after
 * teardown, exactly as it would in a browser.
 */
function createEnvironment() {
  const listeners = new Map();
  const key = (type, capture) => `${type}:${capture ? "capture" : "bubble"}`;

  function add(registry, type, handler, options) {
    const capture = options === true || options?.capture === true;
    const entry = listeners.get(key(`${registry}.${type}`, capture)) ?? [];
    entry.push(handler);
    listeners.set(key(`${registry}.${type}`, capture), entry);
  }

  function remove(registry, type, handler, options) {
    const capture = options === true || options?.capture === true;
    const id = key(`${registry}.${type}`, capture);
    const entry = (listeners.get(id) ?? []).filter((item) => item !== handler);
    if (entry.length) listeners.set(id, entry);
    else listeners.delete(id);
  }

  const observers = [];
  let observerConnections = 0;

  const env = {
    document: {
      visibilityState: "visible",
      activeElement: null,
      addEventListener: (type, handler, options) => add("document", type, handler, options),
      removeEventListener: (type, handler, options) =>
        remove("document", type, handler, options),
    },
    window: {
      addEventListener: (type, handler, options) => add("window", type, handler, options),
      removeEventListener: (type, handler, options) =>
        remove("window", type, handler, options),
    },
    createObserver(callback) {
      const observer = {
        callback,
        connected: true,
        targets: [],
        observe(target) {
          this.targets.push(target);
          observerConnections += 1;
        },
        disconnect() {
          this.connected = false;
          this.targets = [];
        },
      };
      observers.push(observer);
      return observer;
    },
  };

  return {
    env,
    /** Total global listeners currently installed by the hub. */
    globalListenerCount: () =>
      [...listeners.values()].reduce((total, entry) => total + entry.length, 0),
    listenerTypes: () => [...listeners.keys()].sort(),
    /** Number of MutationObserver instances the hub created and kept connected. */
    liveObserverCount: () => observers.filter((observer) => observer.connected).length,
    observerCount: () => observers.length,
    observerConnections: () => observerConnections,
    dispatch(registry, type, event = {}, capture = false) {
      const handlers = listeners.get(key(`${registry}.${type}`, capture)) ?? [];
      for (const handler of [...handlers]) handler(event);
      return handlers.length;
    },
    mutate(target) {
      for (const observer of observers) {
        if (!observer.connected) continue;
        observer.callback([{ target }]);
      }
    },
  };
}

function createRoot(id) {
  const node = {
    id,
    dataset: {},
    children: [],
    contains(other) {
      return other === node || node.children.includes(other);
    },
  };
  return node;
}

function createSurface(harness, id) {
  const calls = {
    touchRelease: 0,
    pointerCancel: 0,
    scroll: 0,
    forceCleanup: 0,
    windowFocus: 0,
    pointerActive: 0,
  };
  const root = createRoot(id);
  const registration = registerProductSurface(
    root,
    {
      onTouchPointerRelease: () => (calls.touchRelease += 1),
      onPointerCancel: () => (calls.pointerCancel += 1),
      onScroll: () => (calls.scroll += 1),
      onForceCleanup: () => (calls.forceCleanup += 1),
      onWindowFocus: () => (calls.windowFocus += 1),
      onPointerActiveChange: () => (calls.pointerActive += 1),
    },
    harness.env,
  );
  return { root, registration, calls };
}

/* -------------------------------------------------------------------------- */
/* Resource counts                                                            */
/* -------------------------------------------------------------------------- */

test("jedna kartica instalira jedan set globalnih listenera i jedan observer", () => {
  const harness = createEnvironment();
  const surface = createSurface(harness, "a");

  assert.equal(harness.globalListenerCount(), 8);
  assert.equal(harness.liveObserverCount(), 1);
  assert.deepEqual(harness.listenerTypes(), [
    "document.lostpointercapture:capture",
    "document.pointercancel:bubble",
    "document.pointerup:bubble",
    "document.scroll:capture",
    "document.visibilitychange:bubble",
    "window.blur:bubble",
    "window.focus:bubble",
    "window.pagehide:bubble",
  ]);

  surface.registration.release();
});

test("48 i 96 kartica ne povećavaju broj globalnih listenera ni observera", () => {
  const harness = createEnvironment();
  const surfaces = [];

  for (let index = 0; index < 48; index += 1) {
    surfaces.push(createSurface(harness, `card-${index}`));
  }
  const at48 = {
    listeners: harness.globalListenerCount(),
    observers: harness.liveObserverCount(),
  };

  for (let index = 48; index < 96; index += 1) {
    surfaces.push(createSurface(harness, `card-${index}`));
  }
  const at96 = {
    listeners: harness.globalListenerCount(),
    observers: harness.liveObserverCount(),
  };

  assert.deepEqual(at48, { listeners: 8, observers: 1 });
  assert.deepEqual(at96, { listeners: 8, observers: 1 });
  assert.equal(getProductSurfaceLifecycleStats(harness.env).surfaces, 96);
  // Jedan observer, ali 96 posmatranih čvorova.
  assert.equal(harness.observerConnections(), 96);

  // 96 -> 48
  for (const surface of surfaces.slice(48)) surface.registration.release();
  assert.equal(harness.globalListenerCount(), 8);
  assert.equal(harness.liveObserverCount(), 1);
  assert.equal(getProductSurfaceLifecycleStats(harness.env).surfaces, 48);

  for (const surface of surfaces.slice(0, 48)) surface.registration.release();
});

test("unmount poslednje instance uklanja sve globalne resurse", () => {
  const harness = createEnvironment();
  const surfaces = [createSurface(harness, "a"), createSurface(harness, "b")];

  surfaces[0].registration.release();
  assert.equal(harness.globalListenerCount(), 8, "jedna preostala instanca drži hub");

  surfaces[1].registration.release();
  assert.equal(harness.globalListenerCount(), 0);
  assert.equal(harness.liveObserverCount(), 0);
  assert.deepEqual(getProductSurfaceLifecycleStats(harness.env), {
    surfaces: 0,
    active: 0,
    capturedPointers: 0,
    installed: false,
  });
});

test("remount posle potpunog unmount-a ponovo instalira tačno jedan set", () => {
  const harness = createEnvironment();
  const first = createSurface(harness, "a");
  first.registration.release();
  assert.equal(harness.globalListenerCount(), 0);

  const second = createSurface(harness, "a");
  assert.equal(harness.globalListenerCount(), 8);
  assert.equal(harness.liveObserverCount(), 1);
  second.registration.release();
});

test("Strict Mode dupli mount ne registruje isti root dvaput", () => {
  const harness = createEnvironment();
  const root = createRoot("strict");
  let firstScrolls = 0;
  let secondScrolls = 0;

  const handlers = (counter) => ({
    onTouchPointerRelease: () => {},
    onPointerCancel: () => {},
    onScroll: counter,
    onForceCleanup: () => {},
    onWindowFocus: () => {},
    onPointerActiveChange: () => {},
  });

  const first = registerProductSurface(root, handlers(() => (firstScrolls += 1)), harness.env);
  const second = registerProductSurface(
    root,
    handlers(() => (secondScrolls += 1)),
    harness.env,
  );

  assert.equal(getProductSurfaceLifecycleStats(harness.env).surfaces, 1);

  second.setActive(true);
  harness.dispatch("document", "scroll", {}, true);
  assert.equal(firstScrolls, 0, "stara registracija više ne dobija događaje");
  assert.equal(secondScrolls, 1);

  // Cleanup prvog efekta (Strict Mode) ne sme oboriti aktivnu registraciju.
  first.release();
  assert.equal(getProductSurfaceLifecycleStats(harness.env).surfaces, 1);
  assert.equal(harness.globalListenerCount(), 8);

  second.release();
  assert.equal(harness.globalListenerCount(), 0);
});

/* -------------------------------------------------------------------------- */
/* Dispatch cost                                                              */
/* -------------------------------------------------------------------------- */

test("globalni događaj ima tačno jedan DOM handler bez obzira na broj kartica", () => {
  const harness = createEnvironment();
  const surfaces = Array.from({ length: 96 }, (_, index) =>
    createSurface(harness, `card-${index}`),
  );

  assert.equal(harness.dispatch("document", "scroll", {}, true), 1);
  assert.equal(harness.dispatch("window", "blur"), 1);
  assert.equal(harness.dispatch("document", "pointerup", { pointerId: 1 }), 1);

  for (const surface of surfaces) surface.registration.release();
});

test("scroll bez aktivne kartice ne poziva nijedan surface callback", () => {
  const harness = createEnvironment();
  const surfaces = Array.from({ length: 96 }, (_, index) =>
    createSurface(harness, `card-${index}`),
  );

  harness.dispatch("document", "scroll", {}, true);
  assert.equal(
    surfaces.reduce((total, surface) => total + surface.calls.scroll, 0),
    0,
  );

  surfaces[7].registration.setActive(true);
  harness.dispatch("document", "scroll", {}, true);
  assert.equal(surfaces[7].calls.scroll, 1);
  assert.equal(
    surfaces.reduce((total, surface) => total + surface.calls.scroll, 0),
    1,
    "samo aktivna kartica reaguje",
  );

  for (const surface of surfaces) surface.registration.release();
});

test("pointerup stiže samo kartici koja drži taj pointer id", () => {
  const harness = createEnvironment();
  const a = createSurface(harness, "a");
  const b = createSurface(harness, "b");

  a.registration.setTouchPointerId(11);
  b.registration.setTouchPointerId(22);

  harness.dispatch("document", "pointerup", { pointerId: 22 });
  assert.equal(a.calls.touchRelease, 0);
  assert.equal(b.calls.touchRelease, 1);

  harness.dispatch("document", "pointerup", { pointerId: 999 });
  assert.equal(a.calls.touchRelease, 0);
  assert.equal(b.calls.touchRelease, 1);

  a.registration.release();
  b.registration.release();
});

test("touch pointercancel i lostpointercapture prate isti pointer id", () => {
  const harness = createEnvironment();
  const a = createSurface(harness, "a");
  a.registration.setTouchPointerId(5);

  harness.dispatch("document", "pointercancel", { pointerId: 5, pointerType: "touch" });
  assert.equal(a.calls.touchRelease, 1);
  assert.equal(a.calls.pointerCancel, 0);

  a.registration.setTouchPointerId(6);
  harness.dispatch(
    "document",
    "lostpointercapture",
    { pointerId: 6, pointerType: "touch" },
    true,
  );
  assert.equal(a.calls.touchRelease, 2);

  a.registration.release();
});

test("ne-touch pointercancel pogađa samo aktivne kartice", () => {
  const harness = createEnvironment();
  const a = createSurface(harness, "a");
  const b = createSurface(harness, "b");
  a.registration.setActive(true);

  harness.dispatch("document", "pointercancel", { pointerId: 1, pointerType: "mouse" });
  assert.equal(a.calls.pointerCancel, 1);
  assert.equal(b.calls.pointerCancel, 0);

  a.registration.release();
  b.registration.release();
});

test("blur, pagehide i visibility hidden čiste aktivne i pritisnute kartice", () => {
  const harness = createEnvironment();
  const active = createSurface(harness, "active");
  const pressed = createSurface(harness, "pressed");
  const idle = createSurface(harness, "idle");
  active.registration.setActive(true);
  pressed.registration.setTouchPointerId(3);

  harness.dispatch("window", "blur");
  assert.equal(active.calls.forceCleanup, 1);
  assert.equal(pressed.calls.forceCleanup, 1);
  assert.equal(idle.calls.forceCleanup, 0);

  harness.dispatch("window", "pagehide");
  assert.equal(active.calls.forceCleanup, 2);

  harness.env.document.visibilityState = "hidden";
  harness.dispatch("document", "visibilitychange");
  assert.equal(active.calls.forceCleanup, 3);

  harness.env.document.visibilityState = "visible";
  harness.dispatch("document", "visibilitychange");
  assert.equal(active.calls.forceCleanup, 3, "vidljiv tab ne izaziva cleanup");

  active.registration.release();
  pressed.registration.release();
  idle.registration.release();
});

test("window focus budi samo karticu koja sadrži fokusirani element", () => {
  const harness = createEnvironment();
  const a = createSurface(harness, "a");
  const b = createSurface(harness, "b");
  const focused = { id: "button" };
  b.root.children.push(focused);
  harness.env.document.activeElement = focused;

  harness.dispatch("window", "focus");
  assert.equal(a.calls.windowFocus, 0);
  assert.equal(b.calls.windowFocus, 1);

  harness.env.document.activeElement = null;
  harness.dispatch("window", "focus");
  assert.equal(b.calls.windowFocus, 1);

  a.registration.release();
  b.registration.release();
});

test("data-pointer-active mutacija pogađa samo vlasnika čvora", () => {
  const harness = createEnvironment();
  const a = createSurface(harness, "a");
  const b = createSurface(harness, "b");

  harness.mutate(b.root);
  assert.equal(a.calls.pointerActive, 0);
  assert.equal(b.calls.pointerActive, 1);

  a.registration.release();
  b.registration.release();
});

test("otkačena kartica više ne dobija nijedan callback", () => {
  const harness = createEnvironment();
  const a = createSurface(harness, "a");
  const b = createSurface(harness, "b");
  a.registration.setActive(true);
  a.registration.setTouchPointerId(9);
  a.registration.release();

  harness.dispatch("document", "scroll", {}, true);
  harness.dispatch("document", "pointerup", { pointerId: 9 });
  harness.dispatch("window", "blur");
  harness.mutate(a.root);

  assert.deepEqual(a.calls, {
    touchRelease: 0,
    pointerCancel: 0,
    scroll: 0,
    forceCleanup: 0,
    windowFocus: 0,
    pointerActive: 0,
  });
  assert.equal(getProductSurfaceLifecycleStats(harness.env).capturedPointers, 0);

  b.registration.release();
});

test("SSR bez DOM-a ne registruje ništa i ne puca", () => {
  assert.equal(
    registerProductSurface(createRoot("ssr"), {
      onTouchPointerRelease: () => {},
      onPointerCancel: () => {},
      onScroll: () => {},
      onForceCleanup: () => {},
      onWindowFocus: () => {},
      onPointerActiveChange: () => {},
    }),
    null,
  );
});
