"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePointerOrb } from "@/components/motion/usePointerOrb";

/*
 * Modalni <dialog> (korpa, potvrde) ide u top layer pregledača, iznad svakog
 * z-index-a, pa bi orb ostao ispod njega, a sistemski kursor je sakriven
 * (`cursor: none`). Orb zato živi u sopstvenom kontejneru koji se premešta u
 * poslednji otvoreni modalni dialog i vraća u body kad se zatvori. Premešta se
 * samo kontejner, ne čvorovi koje drži React, pa se orb ne montira ponovo.
 */
function topModalDialog(): HTMLDialogElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  for (let index = open.length - 1; index >= 0; index -= 1) {
    if (open[index].matches(":modal")) return open[index];
  }
  return null;
}

export function PigmentCursor() {
  const haloRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = document.createElement("div");
    container.dataset.pigmentCursorHost = "";
    document.body.appendChild(container);
    setHost(container);

    // MutationObserver već grupiše promene po mikrozadatku, pa se premešta odmah.
    const sync = () => {
      const target = topModalDialog() ?? document.body;
      if (container.parentNode !== target) target.appendChild(container);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      container.remove();
    };
  }, []);

  usePointerOrb({ dotRef, haloRef, host });

  if (!host) return null;

  return createPortal(
    <>
      <div ref={haloRef} className="cs-pigment-cursor cs-pigment-cursor-halo" aria-hidden="true">
        <span className="cs-pigment-cursor-plus" aria-hidden="true">
          +
        </span>
      </div>
      <div ref={dotRef} className="cs-pigment-cursor cs-pigment-cursor-dot" aria-hidden="true" />
    </>,
    host,
  );
}
