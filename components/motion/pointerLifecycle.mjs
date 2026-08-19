/**
 * Jedan globalni pointer lifecycle po dokumentu.
 *
 * Pre ovoga su postojala dva nezavisna globalna `pointermove` sloja
 * (`usePointerOrb` za custom kursor i `MotionSystem` za lokalne pointer
 * varijable), svaki sa svojim skupom listenera i svojim `requestAnimationFrame`
 * ciklusom, i nijedan nije reagovao na `pointercancel`, `blur`,
 * `visibilitychange` ni `pagehide`. Posledica su bila stanja koja "ostanu":
 * kursor zaglavljen u hover izgledu nad elementom koji je u međuvremenu
 * uklonjen, ili vidljiv orb pošto je pointer odavno napustio prozor.
 *
 * Hub instalira tačno po jedan listener za svaki tip događaja i drži tačno
 * jedan zakazani frame. Potrošači (orb, motion surfaces) se prijavljuju i
 * dobijaju callback-e; kada se odjavi poslednji, hub se u celosti demontira —
 * listeneri skinuti, frame otkazan, mape prazne. To je isti ugovor koji
 * `productSurfaceLifecycle.mjs` već koristi i zbog kojeg React Strict Mode
 * dvostruki mount i HMR remount ne mogu da naslažu duple listenere.
 *
 * Plain JS (ne TS) namerno: ugovor vozi `node --test` nad DOM duplerom koji
 * broji stvarne add/removeEventListener pozive, pa mora postojati tačno jedna
 * implementacija. `pointerLifecycle.ts` je tipizovan omotač.
 */

const hubs = new WeakMap();

/** Razlozi za povratak u neutralno stanje. */
export const RESET_REASONS = [
  "pointercancel",
  "pointerleave",
  "blur",
  "hidden",
  "pagehide",
];

function browserEnvironment() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  return { document, window };
}

function createHub(env) {
  const consumers = new Set();
  const frameRequests = new Set();
  /** Poslednja poznata pozicija miša; refresh hit-test ide kroz nju. */
  let lastPoint = null;
  let frame = 0;
  let refreshPending = false;

  function dispatch(name, ...args) {
    for (const consumer of [...consumers]) {
      consumer.handlers[name]?.(...args);
    }
  }

  function runFrame() {
    frame = 0;

    if (refreshPending) {
      refreshPending = false;
      if (lastPoint) dispatch("onPointerRefresh", lastPoint);
    }

    const pending = [...frameRequests];
    frameRequests.clear();
    for (const consumer of pending) {
      consumer.handlers.onFrame?.();
    }
  }

  /**
   * Jedan zakazan frame za ceo dokument. I animacija orba i re-evaluacija
   * cilja ispod kursora dele isti slot, pa po frame-u postoji najviše jedna
   * obrada bez obzira na to koliko je događaja stiglo.
   */
  function schedule() {
    if (frame) return;
    frame = env.window.requestAnimationFrame(runFrame);
  }

  function cancelFrame() {
    if (!frame) return;
    env.window.cancelAnimationFrame(frame);
    frame = 0;
  }

  function scheduleRefresh() {
    if (!lastPoint) return;
    refreshPending = true;
    schedule();
  }

  function handlePointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    lastPoint = { x: event.clientX, y: event.clientY };
    dispatch("onPointerMove", event);
  }

  /*
   * Boundary događaj stiže i kada se cilj ispod NEPOMIČNOG kursora promeni —
   * zbog skrola ili zbog izmene DOM-a. Zato je re-evaluacija okačena ovde, a
   * ne na posmatranje svakog čvora u dokumentu.
   */
  function handlePointerOver(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (typeof event.clientX === "number") {
      lastPoint = { x: event.clientX, y: event.clientY };
    }
    scheduleRefresh();
  }

  function handlePointerOut(event) {
    dispatch("onPointerOut", event);
  }

  function reset(reason) {
    dispatch("onReset", reason);
  }

  function handlePointerCancel() {
    reset("pointercancel");
  }

  function handlePointerLeave() {
    reset("pointerleave");
  }

  function handleBlur() {
    reset("blur");
  }

  function handlePageHide() {
    reset("pagehide");
  }

  function handleVisibilityChange() {
    if (env.document.visibilityState === "hidden") reset("hidden");
  }

  function handleScroll() {
    scheduleRefresh();
  }

  env.document.addEventListener("pointermove", handlePointerMove, {
    passive: true,
  });
  env.document.addEventListener("pointerover", handlePointerOver, {
    passive: true,
  });
  env.document.addEventListener("pointerout", handlePointerOut);
  env.document.addEventListener("pointercancel", handlePointerCancel, {
    passive: true,
  });
  env.document.addEventListener("pointerleave", handlePointerLeave);
  env.document.addEventListener("visibilitychange", handleVisibilityChange);
  env.window.addEventListener("scroll", handleScroll, { passive: true });
  env.window.addEventListener("blur", handleBlur);
  env.window.addEventListener("pagehide", handlePageHide);

  return {
    env,
    consumers,
    frameRequests,
    schedule,
    hasFrame: () => frame !== 0,
    lastPoint: () => lastPoint,
    teardown() {
      env.document.removeEventListener("pointermove", handlePointerMove);
      env.document.removeEventListener("pointerover", handlePointerOver);
      env.document.removeEventListener("pointerout", handlePointerOut);
      env.document.removeEventListener("pointercancel", handlePointerCancel);
      env.document.removeEventListener("pointerleave", handlePointerLeave);
      env.document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      env.window.removeEventListener("scroll", handleScroll);
      env.window.removeEventListener("blur", handleBlur);
      env.window.removeEventListener("pagehide", handlePageHide);
      cancelFrame();
      consumers.clear();
      frameRequests.clear();
      lastPoint = null;
      refreshPending = false;
    },
  };
}

/**
 * Prijava potrošača. Vraća `null` u SSR-u, gde nema čemu da se prijavi.
 *
 * Handlers: `onPointerMove`, `onPointerOut`, `onPointerRefresh`, `onReset`,
 * `onFrame` — svi opcioni. Tipovi su u `pointerLifecycle.ts`.
 */
export function registerPointerConsumer(handlers, environment) {
  const env = environment ?? browserEnvironment();
  if (!env) return null;

  let hub = hubs.get(env.document);
  if (!hub) {
    hub = createHub(env);
    hubs.set(env.document, hub);
  }
  const activeHub = hub;

  const consumer = { handlers };
  activeHub.consumers.add(consumer);

  let released = false;

  return {
    /** Zakazuje `onFrame` u zajedničkom slotu — nikad drugu RAF petlju. */
    requestFrame() {
      if (released) return;
      activeHub.frameRequests.add(consumer);
      activeHub.schedule();
    },
    cancelFrame() {
      activeHub.frameRequests.delete(consumer);
    },
    lastPoint() {
      return activeHub.lastPoint();
    },
    release() {
      if (released) return;
      released = true;
      activeHub.consumers.delete(consumer);
      activeHub.frameRequests.delete(consumer);
      if (activeHub.consumers.size === 0) {
        activeHub.teardown();
        hubs.delete(env.document);
      }
    },
  };
}

/** Test-only pogled na živo stanje huba. */
export function getPointerLifecycleStats(environment) {
  const hub = hubs.get(environment.document);
  return {
    installed: Boolean(hub),
    consumers: hub?.consumers.size ?? 0,
    scheduledFrame: hub ? hub.hasFrame() : false,
    frameRequests: hub?.frameRequests.size ?? 0,
  };
}
