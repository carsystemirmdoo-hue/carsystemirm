/**
 * DOM dupler za pointer lifecycle testove.
 *
 * Broji stvarne `addEventListener` / `removeEventListener` pozive, drži red
 * `requestAnimationFrame` callback-a i ume da isporuči događaj. Time testovi
 * mogu da tvrde ono što je i bilo slomljeno u produkciji — koliko listenera i
 * koliko RAF petlji stvarno postoji — umesto da proveravaju da neko ime
 * funkcije postoji u izvoru.
 */

function createTarget(name) {
  const listeners = new Map();
  let added = 0;
  let removed = 0;

  return {
    name,
    listeners,
    get added() {
      return added;
    },
    get removed() {
      return removed;
    },
    addEventListener(type, handler) {
      added += 1;
      const bucket = listeners.get(type) ?? [];
      bucket.push(handler);
      listeners.set(type, bucket);
    },
    removeEventListener(type, handler) {
      const bucket = listeners.get(type);
      if (!bucket) return;
      const index = bucket.indexOf(handler);
      if (index === -1) return;
      bucket.splice(index, 1);
      removed += 1;
      if (bucket.length === 0) listeners.delete(type);
    },
    count(type) {
      return listeners.get(type)?.length ?? 0;
    },
    /** Broj svih aktivnih listenera, po tipovima. */
    total() {
      let sum = 0;
      for (const bucket of listeners.values()) sum += bucket.length;
      return sum;
    },
    emit(type, event = {}) {
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event);
    },
  };
}

export function createPointerTestEnvironment({ visibilityState = "visible" } = {}) {
  const documentTarget = createTarget("document");
  const windowTarget = createTarget("window");
  const frames = new Map();
  let nextFrameId = 1;
  let framesRun = 0;

  const env = {
    document: {
      visibilityState,
      addEventListener: documentTarget.addEventListener,
      removeEventListener: documentTarget.removeEventListener,
    },
    window: {
      addEventListener: windowTarget.addEventListener,
      removeEventListener: windowTarget.removeEventListener,
      requestAnimationFrame(callback) {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      },
    },
  };

  return {
    env,
    documentTarget,
    windowTarget,
    setVisibility(next) {
      env.document.visibilityState = next;
    },
    /** Koliko frame-ova trenutno čeka — mora biti najviše 1. */
    pendingFrames() {
      return frames.size;
    },
    framesRun() {
      return framesRun;
    },
    /** Odigrava sve zakazane frame-ove, kao jedan tick browsera. */
    flushFrames() {
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pending) {
        framesRun += 1;
        callback();
      }
      return pending.length;
    },
    emitDocument(type, event) {
      documentTarget.emit(type, event);
    },
    emitWindow(type, event) {
      windowTarget.emit(type, event);
    },
    listenerCount(type) {
      return documentTarget.count(type) + windowTarget.count(type);
    },
    totalListeners() {
      return documentTarget.total() + windowTarget.total();
    },
  };
}

/** Minimalni element za orb: `dataset` i `style.transform`. */
export function createOrbElement() {
  return { dataset: {}, style: { transform: "" } };
}

/** MediaQueryList dupler sa kontrolisanim `matches`. */
export function createMediaQuery(matches) {
  const listeners = new Set();
  return {
    get matches() {
      return matches;
    },
    addEventListener(type, listener) {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.delete(listener);
    },
    listenerCount() {
      return listeners.size;
    },
    set(next) {
      matches = next;
      for (const listener of [...listeners]) listener({ matches });
    },
  };
}
