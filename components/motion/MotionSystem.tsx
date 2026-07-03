"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { MotionConfigProvider } from "@/components/motion/MotionConfigProvider";
import { PigmentCursor } from "@/components/motion/PigmentCursor";
import {
  motionSurfaceSelector,
  resetLocalPointerVars,
  setLocalPointerVars,
} from "@/components/motion/useLocalPointerVars";

function setProductHoverDirection(productCard: HTMLElement) {
  const directions = ["top", "bottom", "side"] as const;
  const hoverCount = Number(productCard.dataset.hoverCount ?? "0");

  productCard.dataset.hoverDirection = directions[hoverCount % directions.length];
  productCard.dataset.hoverCount = String(hoverCount + 1);
  productCard.dataset.productHoverActive = "true";
}

export function MotionSystem({ children }: { children: ReactNode }) {
  const activeSurfaceRef = useRef<HTMLElement | null>(null);
  const activeProductCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;

      const target = event.target instanceof Element ? event.target : null;
      const nextSurface = target?.closest<HTMLElement>(motionSurfaceSelector) ?? null;
      const nextProductCard =
        target?.closest<HTMLElement>("[data-product-card-motion]") ?? null;

      if (activeSurfaceRef.current && activeSurfaceRef.current !== nextSurface) {
        resetLocalPointerVars(activeSurfaceRef.current);
      }

      if (activeProductCardRef.current && activeProductCardRef.current !== nextProductCard) {
        activeProductCardRef.current.dataset.productHoverActive = "false";
      }

      if (nextProductCard && activeProductCardRef.current !== nextProductCard) {
        setProductHoverDirection(nextProductCard);
      }

      activeSurfaceRef.current = nextSurface;
      activeProductCardRef.current = nextProductCard;

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
      if (activeProductCardRef.current) {
        activeProductCardRef.current.dataset.productHoverActive = "false";
        activeProductCardRef.current = null;
      }
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
