/**
 * Ponašanje custom kursora kroz stvarne handlere.
 *
 * Regresije koje se ovde brane:
 *   - hover stanje ostaje vezano za element koji je uklonjen iz DOM-a;
 *   - orb ostaje vidljiv posle izlaska pointera iz prozora, `pointercancel`-a,
 *     gubitka fokusa ili sakrivanja taba;
 *   - zaostale animacije: kursor "juri" staru koordinatu umesto poslednje;
 *   - custom kursor koji se zalepi na coarse-pointer uređaju.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CURSOR_ENABLED_CLASS,
  createPigmentCursorRuntime,
  NEUTRAL_STATE,
} from "./pigmentCursorRuntime.mjs";
import { getPointerLifecycleStats } from "./pointerLifecycle.mjs";
import {
  createMediaQuery,
  createOrbElement,
  createPointerTestEnvironment,
} from "./pointerTestDouble.mjs";

function createHarness({ finePointer = true } = {}) {
  const pointer = createPointerTestEnvironment();
  const halo = createOrbElement();
  const dot = createOrbElement();
  const media = createMediaQuery(finePointer);
  const bodyClasses = new Set();
  /** Šta hit-test vraća; testovi ga menjaju kao što bi DOM promena. */
  let hit = { state: NEUTRAL_STATE, process: "", element: null };

  const runtime = createPigmentCursorRuntime({
    halo,
    dot,
    env: {
      ...pointer.env,
      matchMedia: () => media,
      bodyClassList: {
        add: (name) => bodyClasses.add(name),
        remove: (name) => bodyClasses.delete(name),
      },
      resolveStateFromEvent: () => hit,
      resolveStateFromPoint: () => hit,
      viewportCenter: () => ({ x: 0, y: 0 }),
    },
  });

  return {
    pointer,
    runtime,
    halo,
    dot,
    media,
    bodyClasses,
    setHit(next) {
      hit = next;
    },
    move(x, y) {
      pointer.emitDocument("pointermove", {
        pointerType: "mouse",
        clientX: x,
        clientY: y,
      });
    },
    /** Odigrava frame-ove dok se orb ne smiri (ili do granice koraka). */
    settle(maxFrames = 200) {
      let frames = 0;
      while (pointer.pendingFrames() > 0 && frames < maxFrames) {
        pointer.flushFrames();
        frames += 1;
      }
      return frames;
    },
  };
}

test("orb se uključuje samo na fine pointeru i nosi telo klase", () => {
  const harness = createHarness();
  assert.equal(harness.bodyClasses.has(CURSOR_ENABLED_CLASS), true);
  assert.equal(harness.halo.dataset.enabled, "true");
  assert.equal(harness.dot.dataset.enabled, "true");
  harness.runtime.destroy();
  assert.equal(harness.bodyClasses.has(CURSOR_ENABLED_CLASS), false);
});

test("coarse pointer ne dobija custom kursor ni posle pointer događaja", () => {
  const harness = createHarness({ finePointer: false });

  assert.equal(harness.bodyClasses.has(CURSOR_ENABLED_CLASS), false);
  assert.equal(harness.halo.dataset.enabled, "false");

  harness.setHit({ state: "button", process: "", element: { isConnected: true } });
  harness.move(120, 120);

  assert.equal(harness.halo.dataset.visible, "false");
  assert.notEqual(harness.halo.dataset.state, "button");
  assert.equal(harness.pointer.pendingFrames(), 0, "bez RAF petlje na touch uređaju");

  harness.runtime.destroy();
});

test("prelazak sa fine na coarse pointer gasi i resetuje orb", () => {
  const harness = createHarness();
  harness.setHit({ state: "link", process: "", element: { isConnected: true } });
  harness.move(80, 80);
  assert.equal(harness.halo.dataset.state, "link");
  assert.equal(harness.halo.dataset.visible, "true");

  harness.media.set(false);

  assert.equal(harness.halo.dataset.enabled, "false");
  assert.equal(harness.halo.dataset.visible, "false");
  assert.equal(harness.halo.dataset.state, NEUTRAL_STATE);
  assert.equal(harness.bodyClasses.has(CURSOR_ENABLED_CLASS), false);

  harness.runtime.destroy();
});

test("brzo pomeranje koristi poslednju koordinatu, bez reda zaostalih", () => {
  const harness = createHarness();

  harness.move(100, 100);
  harness.move(400, 300);
  harness.move(900, 700);
  assert.equal(harness.pointer.pendingFrames(), 1, "jedan zakazan frame za tri pomeraja");

  const stats = harness.runtime.stats();
  assert.deepEqual(stats.target, { x: 900, y: 700 });

  harness.settle();
  const settled = harness.runtime.stats();
  assert.ok(Math.abs(settled.dotPosition.x - 900) < 0.5);
  assert.ok(Math.abs(settled.haloPosition.y - 700) < 0.5);
  assert.equal(harness.pointer.pendingFrames(), 0, "petlja mora da stane kad se smiri");

  harness.runtime.destroy();
});

test("hover stanje prati cilj i vraća se u neutralno kad cilj nestane", () => {
  const harness = createHarness();
  const button = { isConnected: true };

  harness.setHit({ state: "button", process: "", element: button });
  harness.move(200, 200);
  assert.equal(harness.halo.dataset.state, "button");
  assert.equal(harness.dot.dataset.state, "button");

  // Element je uklonjen iz DOM-a, kursor se nije pomerio; hit-test sada vraća
  // praznu površinu — isto što bi vratio i pravi `elementFromPoint`.
  button.isConnected = false;
  harness.setHit({ state: NEUTRAL_STATE, process: "", element: null });
  harness.pointer.emitWindow("scroll", {});
  harness.pointer.flushFrames();

  assert.equal(harness.halo.dataset.state, NEUTRAL_STATE);
  assert.equal(harness.runtime.stats().hoverElement, null);

  harness.runtime.destroy();
});

test("skrol ispod nepomičnog kursora preuzima novo stanje", () => {
  const harness = createHarness();

  harness.setHit({ state: "text", process: "", element: { isConnected: true } });
  harness.move(300, 300);
  assert.equal(harness.dot.dataset.state, "text");

  harness.setHit({ state: "image", process: "", element: { isConnected: true } });
  harness.pointer.emitWindow("scroll", {});
  harness.pointer.flushFrames();

  assert.equal(harness.dot.dataset.state, "image");
  assert.equal(harness.halo.dataset.state, "image");

  harness.runtime.destroy();
});

for (const [reason, emit] of [
  ["pointercancel", (h) => h.pointer.emitDocument("pointercancel", { pointerType: "mouse" })],
  ["pointerleave", (h) => h.pointer.emitDocument("pointerleave", {})],
  ["blur", (h) => h.pointer.emitWindow("blur", {})],
  ["pagehide", (h) => h.pointer.emitWindow("pagehide", {})],
  [
    "visibilitychange",
    (h) => {
      h.pointer.setVisibility("hidden");
      h.pointer.emitDocument("visibilitychange", {});
    },
  ],
]) {
  test(`${reason} vraća kursor u neutralno stanje`, () => {
    const harness = createHarness();
    harness.setHit({ state: "card", process: "", element: { isConnected: true } });
    harness.move(250, 250);
    assert.equal(harness.halo.dataset.visible, "true");
    assert.equal(harness.halo.dataset.state, "card");

    emit(harness);

    assert.equal(harness.halo.dataset.visible, "false");
    assert.equal(harness.dot.dataset.visible, "false");
    assert.equal(harness.halo.dataset.state, NEUTRAL_STATE);
    assert.equal(harness.dot.dataset.state, NEUTRAL_STATE);

    harness.runtime.destroy();
  });
}

test("posle reseta prvi sledeći pomeraj ponovo prikazuje kursor", () => {
  const harness = createHarness();
  harness.setHit({ state: "button", process: "", element: { isConnected: true } });
  harness.move(120, 120);
  harness.pointer.emitWindow("blur", {});
  assert.equal(harness.halo.dataset.visible, "false");

  harness.move(140, 160);
  assert.equal(harness.halo.dataset.visible, "true");
  assert.equal(harness.halo.dataset.state, "button");

  harness.runtime.destroy();
});

test("destroy skida sve listenere, otkazuje frame i briše telo klase", () => {
  const harness = createHarness();
  harness.move(300, 300);
  assert.equal(harness.pointer.pendingFrames(), 1);

  harness.runtime.destroy();

  assert.equal(harness.pointer.totalListeners(), 0);
  assert.equal(harness.pointer.pendingFrames(), 0);
  assert.equal(harness.bodyClasses.has(CURSOR_ENABLED_CLASS), false);
  assert.equal(harness.media.listenerCount(), 0);
  assert.equal(getPointerLifecycleStats(harness.pointer.env).installed, false);
});

test("Strict Mode dvostruki mount ostavlja tačno jedan aktivan kursor", () => {
  const first = createHarness();
  const listeners = first.pointer.totalListeners();
  first.runtime.destroy();

  const second = createHarness();
  assert.equal(second.pointer.totalListeners(), listeners);
  assert.equal(second.pointer.env.document.visibilityState, "visible");

  second.move(100, 100);
  assert.equal(second.pointer.pendingFrames(), 1, "samo jedna RAF petlja");

  second.runtime.destroy();
  assert.equal(second.pointer.totalListeners(), 0);
});
