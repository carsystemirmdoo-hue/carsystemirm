"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MotionConfigProvider } from "@/components/motion/MotionConfigProvider";
import { PigmentCursor } from "@/components/motion/PigmentCursor";
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

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;

      const target = event.target instanceof Element ? event.target : null;
      const nextSurface = target?.closest<HTMLElement>(motionSurfaceSelector) ?? null;

      if (activeSurfaceRef.current && activeSurfaceRef.current !== nextSurface) {
        resetLocalPointerVars(activeSurfaceRef.current);
      }

      activeSurfaceRef.current = nextSurface;

      if (nextSurface) {
        setLocalPointerVars(nextSurface, event);
      }
    }

    function handlePointerOut(event: PointerEvent) {
      const surface = activeSurfaceRef.current;
      if (!surface) return;
      if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) return;

      resetLocalPointerVars(surface);
      activeSurfaceRef.current = null;
    }

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerout", handlePointerOut);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, []);

  return (
    <MotionConfigProvider>
      {children}
      <PigmentCursor />
    </MotionConfigProvider>
  );
}
