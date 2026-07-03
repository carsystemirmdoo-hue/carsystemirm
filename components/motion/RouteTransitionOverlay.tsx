"use client";

export type RouteTransitionPhase = "idle" | "covering" | "covered" | "revealing" | "fade";

export function RouteTransitionOverlay({
  phase,
  reducedMotion,
}: {
  phase: RouteTransitionPhase;
  reducedMotion: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="cs-route-transition"
      data-phase={phase}
      data-reduced-motion={reducedMotion || undefined}
    >
      <span className="cs-route-transition-screen" />
    </div>
  );
}
