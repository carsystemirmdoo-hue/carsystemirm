"use client";

import { type RefObject, useEffect } from "react";

const resetTimers = new WeakMap<HTMLElement, number>();

export const motionSurfaceSelector = [
  "[data-motion-surface]",
  ".cs-interactive-surface",
  ".cs-magnetic-cta",
  ".cs-gloss-card",
  ".cs-image-surface",
  ".cs-process-surface",
].join(",");

export function setLocalPointerVars(element: HTMLElement, event: PointerEvent) {
  const resetTimer = resetTimers.get(element);
  if (resetTimer) {
    window.clearTimeout(resetTimer);
    resetTimers.delete(element);
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
  const y = Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100);
  const shiftX = (x - 50) * 0.032;
  const shiftY = (y - 50) * 0.032;
  const tiltX = (50 - y) * 0.024;
  const tiltY = (x - 50) * 0.024;

  element.style.setProperty("--mx", `${x.toFixed(2)}%`);
  element.style.setProperty("--my", `${y.toFixed(2)}%`);
  element.style.setProperty("--motion-shift-x", `${shiftX.toFixed(2)}px`);
  element.style.setProperty("--motion-shift-y", `${shiftY.toFixed(2)}px`);
  element.style.setProperty("--motion-tilt-x", `${tiltX.toFixed(2)}deg`);
  element.style.setProperty("--motion-tilt-y", `${tiltY.toFixed(2)}deg`);
  element.dataset.pointerActive = "true";
  element.dataset.pointerLeaving = "false";
}

export function resetLocalPointerVars(element: HTMLElement, immediate = false) {
  const resetTimer = resetTimers.get(element);
  if (resetTimer) {
    window.clearTimeout(resetTimer);
    resetTimers.delete(element);
  }

  element.dataset.pointerActive = "false";

  if (!immediate) {
    element.dataset.pointerLeaving = "true";

    const nextTimer = window.setTimeout(() => {
      element.style.setProperty("--mx", "50%");
      element.style.setProperty("--my", "50%");
      element.style.setProperty("--motion-shift-x", "0px");
      element.style.setProperty("--motion-shift-y", "0px");
      element.style.setProperty("--motion-tilt-x", "0deg");
      element.style.setProperty("--motion-tilt-y", "0deg");
      element.dataset.pointerLeaving = "false";
      resetTimers.delete(element);
    }, 240);

    resetTimers.set(element, nextTimer);
    return;
  }

  element.style.setProperty("--mx", "50%");
  element.style.setProperty("--my", "50%");
  element.style.setProperty("--motion-shift-x", "0px");
  element.style.setProperty("--motion-shift-y", "0px");
  element.style.setProperty("--motion-tilt-x", "0deg");
  element.style.setProperty("--motion-tilt-y", "0deg");
  element.dataset.pointerLeaving = "false";
}

export function useLocalPointerVars<TElement extends HTMLElement>(
  ref: RefObject<TElement>,
) {
  useEffect(() => {
    const currentElement = ref.current;
    if (!currentElement) return undefined;

    const element: HTMLElement = currentElement;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      setLocalPointerVars(element, event);
    }

    function handlePointerLeave() {
      resetLocalPointerVars(element);
    }

    resetLocalPointerVars(element, true);
    element.addEventListener("pointermove", handlePointerMove, { passive: true });
    element.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [ref]);
}
