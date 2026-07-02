"use client";

import { useRef } from "react";
import { usePointerOrb } from "@/components/motion/usePointerOrb";

export function PigmentCursor() {
  const haloRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  usePointerOrb({ dotRef, haloRef });

  return (
    <>
      <div ref={haloRef} className="cs-pigment-cursor cs-pigment-cursor-halo" aria-hidden="true">
        <span className="cs-pigment-cursor-plus" aria-hidden="true">
          +
        </span>
      </div>
      <div ref={dotRef} className="cs-pigment-cursor cs-pigment-cursor-dot" aria-hidden="true" />
    </>
  );
}
