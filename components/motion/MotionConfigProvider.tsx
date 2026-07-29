"use client";

import {
  createContext,
  Suspense,
  type ReactNode,
  useContext,
  useEffect,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

function RouteCommitObserver({
  onRouteCommit,
}: {
  onRouteCommit: (routeKey: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = `${pathname}${search ? `?${search}` : ""}`;

  useEffect(() => {
    onRouteCommit(routeKey);
  }, [onRouteCommit, routeKey]);

  return null;
}

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
        onCoverComplete={routeTransition.onCoverComplete}
        onOpenComplete={routeTransition.onOpenComplete}
        phase={routeTransition.phase}
        reducedMotion={routeTransition.reducedMotion}
      />
      <Suspense fallback={null}>
        <RouteCommitObserver onRouteCommit={routeTransition.onRouteCommit} />
      </Suspense>
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
