"use client";

import type { AnimationEvent as ReactAnimationEvent } from "react";

export type RouteTransitionPhase =
  | "booting"
  | "idle"
  | "closing"
  | "covered"
  | "navigating"
  | "opening";

export function RouteTransitionOverlay({
  onCoverComplete,
  onOpenComplete,
  phase,
  reducedMotion,
}: {
  onCoverComplete: () => void;
  onOpenComplete: () => void;
  phase: RouteTransitionPhase;
  reducedMotion: boolean;
}) {
  function handleAnimationEnd(
    event: ReactAnimationEvent<HTMLSpanElement>,
  ) {
    if (event.animationName === "cs-route-cover") {
      onCoverComplete();
      return;
    }

    if (event.animationName === "cs-route-reveal") {
      onOpenComplete();
    }
  }

  return (
    <div
      aria-hidden="true"
      className="cs-route-transition"
      data-phase={phase}
      data-reduced-motion={reducedMotion || undefined}
    >
      <span
        className="cs-route-transition-screen"
        onAnimationEnd={handleAnimationEnd}
      />
    </div>
  );
}
