"use client";

import {
  createContext,
  type ReactNode,
  useContext,
} from "react";
import { RouteTransitionOverlay } from "@/components/motion/RouteTransitionOverlay";
import { useRouteTransition } from "@/components/motion/useRouteTransition";

type MotionTransitionContextValue = {
  runThemeTransition: (swapTheme: () => void) => void;
};

const MotionTransitionContext = createContext<MotionTransitionContextValue | null>(null);

export function MotionConfigProvider({ children }: { children: ReactNode }) {
  const routeTransition = useRouteTransition();

  return (
    <MotionTransitionContext.Provider
      value={{ runThemeTransition: routeTransition.runThemeTransition }}
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
