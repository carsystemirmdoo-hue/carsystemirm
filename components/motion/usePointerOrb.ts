"use client";

import { type RefObject, useEffect } from "react";

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

function canUseOrb() {
  return window.matchMedia(
    "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  ).matches;
}

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

function getCursorState(target: EventTarget | null): {
  process: string;
  state: CursorState;
} {
  if (!(target instanceof Element)) return { process: "", state: "default" };

  const explicit = target.closest<HTMLElement>(cursorSelector);
  const cursor = explicit?.dataset.cursor;

  if (cursor === "text") return { process: "", state: "text" };
  if (cursor === "smalltext") return { process: "", state: "smalltext" };
  if (cursor === "link") return { process: "", state: "link" };
  if (cursor === "button" || cursor === "cta") return { process: "", state: "button" };
  if (cursor === "card") return { process: "", state: "card" };
  if (cursor === "image") return { process: "", state: "image" };
  if (cursor === "process" || cursor === "phase") {
    return {
      process: explicit?.dataset.process ?? explicit?.dataset.phase ?? "",
      state: "process",
    };
  }

  if (explicit?.matches("button, [role='button'], input, select, textarea")) {
    return { process: "", state: "button" };
  }

  if (explicit?.matches("a[href]")) {
    return { process: "", state: "link" };
  }

  const textElement = target.closest<HTMLElement>(Array.from(textualTags).join(","));
  if (textElement && hasDirectText(textElement)) {
    const fontSize = Number.parseFloat(window.getComputedStyle(textElement).fontSize);
    return { process: "", state: fontSize >= 26 ? "text" : "smalltext" };
  }

  return { process: "", state: "default" };
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

    const halo: HTMLDivElement = currentHalo;
    const dot: HTMLDivElement = currentDot;

    const media = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const haloPosition = { ...target };
    const dotPosition = { ...target };
    let frame = 0;
    let enabled = false;
    let visible = false;
    let stateKey = "";

    function cancelFrame() {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    function requestFrame() {
      if (!frame && enabled && visible) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    function setEnabled(next: boolean) {
      enabled = next;
      document.body.classList.toggle("cs-pigment-cursor-enabled", next);
      halo.dataset.enabled = next ? "true" : "false";
      dot.dataset.enabled = next ? "true" : "false";
      if (!next) cancelFrame();
    }

    function setVisible(next: boolean) {
      visible = next;
      halo.dataset.visible = next ? "true" : "false";
      dot.dataset.visible = next ? "true" : "false";
      if (next) requestFrame();
      else cancelFrame();
    }

    function updateState(eventTarget: EventTarget | null) {
      const { process, state } = getCursorState(eventTarget);
      const nextKey = `${state}:${process}`;
      if (nextKey === stateKey) return;

      stateKey = nextKey;
      halo.dataset.state = state;
      dot.dataset.state = state;
      halo.dataset.process = process;
      dot.dataset.process = process;
    }

    function move(event: PointerEvent) {
      if (!enabled || event.pointerType !== "mouse") return;
      target.x = event.clientX;
      target.y = event.clientY;
      updateState(event.target);
      setVisible(true);
      requestFrame();
    }

    function leave() {
      setVisible(false);
    }

    function tick() {
      frame = 0;
      if (!enabled || !visible) return;

      const haloEase = 0.16;
      const dotEase = 0.36;
      haloPosition.x += (target.x - haloPosition.x) * haloEase;
      haloPosition.y += (target.y - haloPosition.y) * haloEase;
      dotPosition.x += (target.x - dotPosition.x) * dotEase;
      dotPosition.y += (target.y - dotPosition.y) * dotEase;

      halo.style.transform = `translate3d(${haloPosition.x}px, ${haloPosition.y}px, 0) translate(-50%, -50%)`;
      dot.style.transform = `translate3d(${dotPosition.x}px, ${dotPosition.y}px, 0) translate(-50%, -50%)`;

      const remainingDistance = Math.max(
        Math.abs(target.x - haloPosition.x),
        Math.abs(target.y - haloPosition.y),
        Math.abs(target.x - dotPosition.x),
        Math.abs(target.y - dotPosition.y),
      );
      if (remainingDistance > 0.1) requestFrame();
    }

    function updateEnabled() {
      const nextEnabled = canUseOrb();
      setEnabled(nextEnabled);
      if (!nextEnabled) setVisible(false);
    }

    updateEnabled();
    media.addEventListener("change", updateEnabled);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);

    return () => {
      media.removeEventListener("change", updateEnabled);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      document.body.classList.remove("cs-pigment-cursor-enabled");
      cancelFrame();
    };
  }, [dotRef, haloRef]);
}
