"use client";

import {
  createContext,
  type ReactNode,
  useContext,
} from "react";
import {
  RouteTransitionOverlay,
  type RouteTransitionPhase,
} from "@/components/motion/RouteTransitionOverlay";
import { useRouteTransition } from "@/components/motion/useRouteTransition";

type MotionTransitionContextValue = {
  phase: RouteTransitionPhase;
  reducedMotion: boolean;
  runThemeTransition: (swapTheme: () => void) => void;
};

const MotionTransitionContext = createContext<MotionTransitionContextValue | null>(null);

export function MotionConfigProvider({ children }: { children: ReactNode }) {
  const routeTransition = useRouteTransition();

  return (
    <MotionTransitionContext.Provider
      value={{
        phase: routeTransition.phase,
        reducedMotion: routeTransition.reducedMotion,
        runThemeTransition: routeTransition.runThemeTransition,
      }}
    >
      <RouteTransitionOverlay
        phase={routeTransition.phase}
        reducedMotion={routeTransition.reducedMotion}
      />
      {children}
    </MotionTransitionContext.Provider>
  );
}

export function useMotionTransition() {
  const context = useContext(MotionTransitionContext);

  if (context) return context.runThemeTransition;

  return (swapTheme: () => void) => swapTheme();
}

export function useMotionTransitionState() {
  const context = useContext(MotionTransitionContext);

  return {
    phase: context?.phase ?? "idle",
    reducedMotion: context?.reducedMotion ?? false,
  } as const;
}
