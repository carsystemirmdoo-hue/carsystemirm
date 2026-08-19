"use client";

import { type RefObject, useEffect } from "react";
import {
  createPigmentCursorRuntime,
  type PigmentCursorElement,
  type PigmentCursorState,
} from "@/components/motion/pigmentCursorRuntime";
import type { PointerPoint } from "@/components/motion/pointerLifecycle";

type CursorState =
  | "default"
  | "text"
  | "smalltext"
  | "link"
  | "button"
  | "card"
  | "image"
  | "process";

const cursorSelector = [
  "[data-cursor]",
  "a[href]",
  "button",
  "[role='button']",
  "input",
  "select",
  "textarea",
].join(",");

const textualTags = new Set([
  "A",
  "B",
  "DD",
  "DT",
  "EM",
  "FIGCAPTION",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LABEL",
  "LI",
  "P",
  "SMALL",
  "SPAN",
  "STRONG",
]);

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

/**
 * Klasifikacija cilja ispod kursora. Ostaje DOM-specifična i van runtime-a:
 * runtime zna samo za `{state, process, element}`, pa se njegov lifecycle može
 * voziti u `node --test` bez DOM-a.
 */
function getCursorState(target: EventTarget | null): {
  element: Element | null;
  process: string;
  state: CursorState;
} {
  if (!(target instanceof Element)) {
    return { element: null, process: "", state: "default" };
  }

  const explicit = target.closest<HTMLElement>(cursorSelector);
  const cursor = explicit?.dataset.cursor;

  if (cursor === "text") return { element: explicit, process: "", state: "text" };
  if (cursor === "smalltext") {
    return { element: explicit, process: "", state: "smalltext" };
  }
  if (cursor === "link") return { element: explicit, process: "", state: "link" };
  if (cursor === "button" || cursor === "cta") {
    return { element: explicit, process: "", state: "button" };
  }
  if (cursor === "card") return { element: explicit, process: "", state: "card" };
  if (cursor === "image") return { element: explicit, process: "", state: "image" };
  if (cursor === "process" || cursor === "phase") {
    return {
      element: explicit,
      process: explicit?.dataset.process ?? explicit?.dataset.phase ?? "",
      state: "process",
    };
  }

  if (explicit?.matches("button, [role='button'], input, select, textarea")) {
    return { element: explicit, process: "", state: "button" };
  }

  if (explicit?.matches("a[href]")) {
    return { element: explicit, process: "", state: "link" };
  }

  const textElement = target.closest<HTMLElement>(Array.from(textualTags).join(","));
  if (textElement && hasDirectText(textElement)) {
    const fontSize = Number.parseFloat(window.getComputedStyle(textElement).fontSize);
    return {
      element: textElement,
      process: "",
      state: fontSize >= 26 ? "text" : "smalltext",
    };
  }

  return { element: target, process: "", state: "default" };
}

export function usePointerOrb({
  dotRef,
  haloRef,
}: {
  dotRef: RefObject<HTMLDivElement>;
  haloRef: RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    const currentHalo = haloRef.current;
    const currentDot = dotRef.current;
    if (!currentHalo || !currentDot) return undefined;

    const resolveFromEvent = (event: PointerEvent): PigmentCursorState =>
      getCursorState(event.target);
    const resolveFromPoint = (point: PointerPoint): PigmentCursorState =>
      getCursorState(document.elementFromPoint(point.x, point.y));

    const runtime = createPigmentCursorRuntime({
      halo: currentHalo as unknown as PigmentCursorElement,
      dot: currentDot as unknown as PigmentCursorElement,
      env: {
        document,
        window,
        matchMedia: (query) => window.matchMedia(query),
        bodyClassList: document.body.classList,
        resolveStateFromEvent: resolveFromEvent,
        resolveStateFromPoint: resolveFromPoint,
        viewportCenter: () => ({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }),
      },
    });

    return () => runtime.destroy();
  }, [dotRef, haloRef]);
}
