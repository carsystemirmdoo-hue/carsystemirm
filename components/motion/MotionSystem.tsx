"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MotionConfigProvider } from "@/components/motion/MotionConfigProvider";
import { PigmentCursor } from "@/components/motion/PigmentCursor";
import { registerPointerConsumer } from "@/components/motion/pointerLifecycle";
import {
  motionSurfaceSelector,
  resetLocalPointerVars,
  setLocalPointerVars,
} from "@/components/motion/useLocalPointerVars";

export function MotionSystem({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/portal")) return <>{children}</>;

  return <PublicMotionSystem>{children}</PublicMotionSystem>;
}

function PublicMotionSystem({ children }: { children: ReactNode }) {
  const activeSurfaceRef = useRef<HTMLElement | null>(null);

  /*
   * Lokalne pointer varijable dele isti globalni lifecycle sa custom kursorom.
   * Ranije su bili dva nezavisna `pointermove` sloja; sada je jedan, pa je i
   * povratak u neutralno stanje (cancel, izlazak iz prozora, blur, hidden)
   * zajednički — površina ne može da ostane "zalepljena" u hover stanju.
   */
  useEffect(() => {
    function releaseActiveSurface() {
      const surface = activeSurfaceRef.current;
      if (!surface) return;
      resetLocalPointerVars(surface);
      activeSurfaceRef.current = null;
    }

    const registration = registerPointerConsumer({
      onPointerMove(event) {
        const target = event.target instanceof Element ? event.target : null;
        const nextSurface =
          target?.closest<HTMLElement>(motionSurfaceSelector) ?? null;

        if (activeSurfaceRef.current && activeSurfaceRef.current !== nextSurface) {
          resetLocalPointerVars(activeSurfaceRef.current);
        }

        activeSurfaceRef.current = nextSurface;

        if (nextSurface) {
          setLocalPointerVars(nextSurface, event);
        }
      },
      onPointerOut(event) {
        const surface = activeSurfaceRef.current;
        if (!surface) return;
        if (
          event.relatedTarget instanceof Node &&
          surface.contains(event.relatedTarget)
        ) {
          return;
        }

        releaseActiveSurface();
      },
      onPointerRefresh() {
        // Aktivna površina je mogla da nestane ispod nepomičnog kursora.
        const surface = activeSurfaceRef.current;
        if (surface && !surface.isConnected) activeSurfaceRef.current = null;
      },
      onReset() {
        releaseActiveSurface();
      },
    });

    return () => registration?.release();
  }, []);

  return (
    <MotionConfigProvider>
      {children}
      <PigmentCursor />
    </MotionConfigProvider>
  );
}
