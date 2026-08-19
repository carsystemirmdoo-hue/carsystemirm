/**
 * Ugovor globalnog pointer lifecycle-a.
 *
 * Hvata tačno ono što je u produkciji išlo naopako:
 *   - dva nezavisna globalna `pointermove` sloja i dve RAF petlje,
 *   - listeneri koji se u Strict Mode dvostrukom mount-u naslažu,
 *   - nedostatak reset događaja (`pointercancel`, `blur`, `visibilitychange`,
 *     `pagehide`), zbog kojih je stanje ostajalo "zalepljeno".
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  getPointerLifecycleStats,
  registerPointerConsumer,
} from "./pointerLifecycle.mjs";
import { createPointerTestEnvironment } from "./pointerTestDouble.mjs";

const EVENT_TYPES = [
  "pointermove",
  "pointerover",
  "pointerout",
  "pointercancel",
  "pointerleave",
  "visibilitychange",
  "scroll",
  "blur",
  "pagehide",
];

function recorder() {
  const calls = [];
  return {
    calls,
    handlers: {
      onPointerMove: (event) => calls.push(["move", event.clientX, event.clientY]),
      onPointerOut: () => calls.push(["out"]),
      onPointerRefresh: (point) => calls.push(["refresh", point.x, point.y]),
      onReset: (reason) => calls.push(["reset", reason]),
      onFrame: () => calls.push(["frame"]),
    },
  };
}

test("dva potrošača dele tačno jedan listener po tipu događaja", () => {
  const harness = createPointerTestEnvironment();
  const first = registerPointerConsumer(recorder().handlers, harness.env);
  const second = registerPointerConsumer(recorder().handlers, harness.env);

  for (const type of EVENT_TYPES) {
    assert.equal(harness.listenerCount(type), 1, `${type} nije jedinstven`);
  }
  assert.equal(getPointerLifecycleStats(harness.env).consumers, 2);

  first.release();
  second.release();
});

test("Strict Mode mount → unmount → mount ne duplira listenere", () => {
  const harness = createPointerTestEnvironment();

  const first = registerPointerConsumer(recorder().handlers, harness.env);
  const listenersAfterFirst = harness.totalListeners();
  first.release();
  assert.equal(harness.totalListeners(), 0, "unmount mora skinuti sve listenere");

  const second = registerPointerConsumer(recorder().handlers, harness.env);
  assert.equal(harness.totalListeners(), listenersAfterFirst);
  for (const type of EVENT_TYPES) {
    assert.equal(harness.listenerCount(type), 1, `${type} je dupliran`);
  }

  second.release();
  assert.equal(harness.totalListeners(), 0);
  assert.equal(getPointerLifecycleStats(harness.env).installed, false);
});

test("hub opstaje dok postoji bar jedan potrošač", () => {
  const harness = createPointerTestEnvironment();
  const first = registerPointerConsumer(recorder().handlers, harness.env);
  const second = registerPointerConsumer(recorder().handlers, harness.env);

  first.release();
  assert.equal(getPointerLifecycleStats(harness.env).installed, true);
  assert.equal(harness.listenerCount("pointermove"), 1);

  second.release();
  assert.equal(getPointerLifecycleStats(harness.env).installed, false);
  assert.equal(harness.totalListeners(), 0);
});

test("po frame-u postoji najviše jedna zakazana obrada", () => {
  const harness = createPointerTestEnvironment();
  const first = recorder();
  const second = recorder();
  const a = registerPointerConsumer(first.handlers, harness.env);
  const b = registerPointerConsumer(second.handlers, harness.env);

  a.requestFrame();
  a.requestFrame();
  b.requestFrame();
  harness.emitDocument("pointermove", {
    pointerType: "mouse",
    clientX: 10,
    clientY: 20,
  });
  harness.emitWindow("scroll", {});

  assert.equal(harness.pendingFrames(), 1, "više od jednog zakazanog frame-a");
  harness.flushFrames();
  assert.equal(harness.pendingFrames(), 0);

  assert.equal(first.calls.filter(([name]) => name === "frame").length, 1);
  assert.equal(second.calls.filter(([name]) => name === "frame").length, 1);

  a.release();
  b.release();
});

test("pointermove nosi poslednju koordinatu i ignoriše ne-miš uređaje", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);

  harness.emitDocument("pointermove", {
    pointerType: "touch",
    clientX: 5,
    clientY: 5,
  });
  assert.equal(consumer.calls.length, 0, "touch ne sme da vozi custom kursor");

  harness.emitDocument("pointermove", {
    pointerType: "mouse",
    clientX: 40,
    clientY: 60,
  });
  harness.emitDocument("pointermove", {
    pointerType: "mouse",
    clientX: 400,
    clientY: 300,
  });

  assert.deepEqual(consumer.calls, [
    ["move", 40, 60],
    ["move", 400, 300],
  ]);
  assert.deepEqual(registration.lastPoint(), { x: 400, y: 300 });

  registration.release();
});

test("skrol traži re-evaluaciju cilja, najviše jednom po frame-u", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);

  // Bez poznate koordinate nema šta da se re-evaluira.
  harness.emitWindow("scroll", {});
  assert.equal(harness.pendingFrames(), 0);

  harness.emitDocument("pointermove", {
    pointerType: "mouse",
    clientX: 120,
    clientY: 240,
  });
  harness.emitWindow("scroll", {});
  harness.emitWindow("scroll", {});
  harness.emitWindow("scroll", {});
  assert.equal(harness.pendingFrames(), 1);

  harness.flushFrames();
  const refreshes = consumer.calls.filter(([name]) => name === "refresh");
  assert.deepEqual(refreshes, [["refresh", 120, 240]]);

  registration.release();
});

test("boundary događaj ispod nepomičnog kursora zakazuje re-evaluaciju", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);

  harness.emitDocument("pointerover", {
    pointerType: "mouse",
    clientX: 15,
    clientY: 25,
  });
  harness.flushFrames();

  assert.deepEqual(
    consumer.calls.filter(([name]) => name === "refresh"),
    [["refresh", 15, 25]],
  );

  registration.release();
});

test("svaki razlog za reset stiže do potrošača", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);

  harness.emitDocument("pointercancel", { pointerType: "mouse" });
  harness.emitDocument("pointerleave", {});
  harness.emitWindow("blur", {});
  harness.emitWindow("pagehide", {});
  harness.setVisibility("hidden");
  harness.emitDocument("visibilitychange", {});

  assert.deepEqual(
    consumer.calls.map(([, reason]) => reason),
    ["pointercancel", "pointerleave", "blur", "pagehide", "hidden"],
  );

  registration.release();
});

test("vidljiv dokument ne izaziva reset na visibilitychange", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);

  harness.emitDocument("visibilitychange", {});
  assert.equal(consumer.calls.length, 0);

  registration.release();
});

test("release otkazuje zakazani frame i ne isporučuje ga posle unmount-a", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);

  registration.requestFrame();
  assert.equal(harness.pendingFrames(), 1);

  registration.release();
  assert.equal(harness.pendingFrames(), 0, "RAF mora biti otkazan pri unmount-u");
  harness.flushFrames();
  assert.equal(consumer.calls.length, 0);
});

test("posle release-a događaji više ne stižu do potrošača", () => {
  const harness = createPointerTestEnvironment();
  const consumer = recorder();
  const registration = registerPointerConsumer(consumer.handlers, harness.env);
  registration.release();

  harness.emitDocument("pointermove", {
    pointerType: "mouse",
    clientX: 1,
    clientY: 1,
  });
  harness.emitWindow("blur", {});
  assert.equal(consumer.calls.length, 0);
});
