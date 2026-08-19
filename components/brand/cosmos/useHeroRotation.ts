"use client";

import { useEffect, type RefObject } from "react";

/**
 * Hero product rotation — ambient motion plus direct manipulation.
 *
 * ASSET REALITY: the catalogue holds one fixed-angle 800x800 packshot per
 * variant. There is no 3D geometry and no turntable frame sequence, so a real
 * turntable is impossible and pretending otherwise would look broken. This is a
 * deliberate 2.5D illusion instead: a small perspective Y-rotation, a specular
 * shade that rolls with the angle, a directional shadow, and motion blur that
 * exists only while the can is actually moving. The rotation is clamped well
 * before the angle at which a flat plane stops reading as a cylinder.
 *
 * NO NEW DEPENDENCY. One rAF loop writes CSS custom properties straight to the
 * six image elements — React never re-renders during motion or during a drag.
 * The loop is gated by an IntersectionObserver, so an off-screen hero costs
 * nothing.
 */

/** Beyond roughly this angle a flat packshot stops reading as a cylinder. */
const MAX_SPIN_DEG = 21;
/** How far the shared drag value may travel before the lead can is clamped. */
const MAX_DRIVE_DEG = 26;
/*
 * Deliberately low. At a higher ratio a short flick slams the lead can into its
 * clamp immediately, which feels twitchy rather than weighted — the user should
 * be able to modulate the angle across a deliberate drag of roughly 130px.
 */
const DRAG_SENSITIVITY = 0.16;

type SlotMotion = {
  /** Share of the drag this can receives — the lead can leads, others follow. */
  factor: number;
  /** Ambient oscillation amplitude in degrees. */
  amplitude: number;
  /** Ambient angular speed. */
  speed: number;
  /** Vertical float amplitude in pixels. */
  float: number;
  phase: number;
};

/*
 * Supporting cans move markedly less than the lead can. Enough that the scene
 * feels spatial and connected rather than "one product rotates and everything
 * else is dead", but not enough to compete for attention.
 */
const SLOTS: SlotMotion[] = [
  { factor: 1, amplitude: 2.1, speed: 0.00021, float: 5, phase: 0 },
  { factor: 0.46, amplitude: 2.6, speed: 0.00026, float: 7, phase: 1.1 },
  { factor: 0.34, amplitude: 2.9, speed: 0.00018, float: 8, phase: 2.4 },
  { factor: 0.22, amplitude: 3.2, speed: 0.00029, float: 9, phase: 3.6 },
  { factor: 0.16, amplitude: 3.4, speed: 0.00023, float: 10, phase: 4.7 },
  { factor: 0.12, amplitude: 3.6, speed: 0.00031, float: 11, phase: 5.9 },
];

export function useHeroRotation(heroRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const cans = Array.from(
      hero.querySelectorAll<HTMLElement>("[data-slot]"),
    ).sort(
      (a, b) => Number(a.dataset.slot ?? 0) - Number(b.dataset.slot ?? 0),
    );
    if (cans.length === 0) return undefined;

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Shared user-driven angle, plus its momentum after release.
    let drive = 0;
    let velocity = 0;
    let dragging = false;
    let claimed = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startDrive = 0;
    let lastX = 0;
    let hasInteracted = false;

    const previous = cans.map(() => 0);
    let frame = 0;
    let running = false;
    let visible = false;

    const render = (time: number) => {
      const reduced = reduceQuery.matches;

      if (!dragging) {
        if (Math.abs(velocity) > 0.02) {
          // Coast: inertial follow-through after the user lets go.
          drive += velocity;
          velocity *= 0.93;
        } else {
          velocity = 0;
          // Settle: ease back to rest so the can returns to idle motion.
          drive *= 0.925;
          if (Math.abs(drive) < 0.02) drive = 0;
        }
      }
      drive = Math.max(-MAX_DRIVE_DEG, Math.min(MAX_DRIVE_DEG, drive));

      let moving = false;

      cans.forEach((can, index) => {
        const slot = SLOTS[index] ?? SLOTS[SLOTS.length - 1];

        const ambientSpin = reduced
          ? 0
          : Math.sin(time * slot.speed + slot.phase) * slot.amplitude;
        const ambientFloat = reduced
          ? 0
          : Math.sin(time * slot.speed * 0.72 + slot.phase * 1.7) * slot.float;

        const driven = drive * slot.factor;
        const spin = Math.max(
          -MAX_SPIN_DEG,
          Math.min(MAX_SPIN_DEG, driven + ambientSpin),
        );

        const delta = Math.abs(spin - previous[index]);
        previous[index] = spin;
        if (delta > 0.06) moving = true;

        // Motion blur exists only while the can is genuinely turning, and is
        // capped low so it never becomes a smear.
        const spinBlur = reduced ? 0 : Math.min(delta * 1.9, 1.3);

        // Specular roll: the highlight travels across the can as it turns,
        // which is what sells a cylinder rotating rather than a card tilting.
        const shade = 1 + Math.sin((spin * Math.PI) / 180 * 2.1) * 0.12;

        can.style.setProperty("--can-spin", `${spin.toFixed(2)}deg`);
        can.style.setProperty("--can-float", `${ambientFloat.toFixed(2)}px`);
        can.style.setProperty("--can-spin-blur", `${spinBlur.toFixed(2)}px`);
        can.style.setProperty("--can-shade", shade.toFixed(3));
        can.style.setProperty("--can-shadow-x", `${(-spin * 0.6).toFixed(1)}px`);
      });

      if (moving) hero.dataset.moving = "true";
      else delete hero.dataset.moving;

      // Under reduced motion there is nothing to animate unless the user is
      // actively dragging, so the loop can stop entirely.
      const idle =
        reduceQuery.matches && !dragging && drive === 0 && velocity === 0;
      if (running && !idle) frame = requestAnimationFrame(render);
      else running = false;
    };

    const start = () => {
      if (running || !visible) return;
      running = true;
      frame = requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    // --- direct manipulation ------------------------------------------------

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      lastX = event.clientX;
      startDrive = drive;
      dragging = false;
      claimed = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (!claimed) {
        // Decide once whether this gesture belongs to us. A mostly-vertical
        // gesture is a page scroll and must never be stolen; `touch-action:
        // pan-y` on the hero means the browser keeps handling that natively.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          pointerId = null;
          return;
        }
        claimed = true;
        dragging = true;
        hero.dataset.dragging = "true";
        if (!hasInteracted) {
          hasInteracted = true;
          hero.dataset.hinted = "done";
        }
        try {
          (event.target as Element).setPointerCapture?.(event.pointerId);
        } catch {
          /* capture is best-effort */
        }
        start();
      }

      if (event.cancelable) event.preventDefault();
      velocity = (event.clientX - lastX) * DRAG_SENSITIVITY;
      lastX = event.clientX;
      drive = startDrive + dx * DRAG_SENSITIVITY;
    };

    const endDrag = () => {
      if (pointerId === null) return;
      pointerId = null;
      if (!claimed) return;
      claimed = false;
      dragging = false;
      delete hero.dataset.dragging;
      start();
    };

    hero.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag, { passive: true });
    window.addEventListener("pointercancel", endDrag, { passive: true });

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(hero);

    const onPreferenceChange = () => start();
    reduceQuery.addEventListener("change", onPreferenceChange);

    return () => {
      observer.disconnect();
      stop();
      hero.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      reduceQuery.removeEventListener("change", onPreferenceChange);
    };
  }, [heroRef]);
}
