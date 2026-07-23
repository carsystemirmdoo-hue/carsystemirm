"use client";

import { useEffect, useRef } from "react";
import {
  getPaintTakeoverPhase,
  paintStrokeConfig,
  type PaintStrokeConfig,
  type StrokeEasing,
} from "./paintTakeoverConfig";

type StrokeRuntime = {
  config: PaintStrokeConfig;
  element: SVGGElement;
  lineElements: SVGGeometryElement[];
  maskRect: SVGRectElement | null;
  maskPath: SVGPathElement | null;
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

function ease(progress: number, easing: StrokeEasing) {
  if (easing === "quart-out") return 1 - Math.pow(1 - progress, 4);
  if (easing === "quint-out") return 1 - Math.pow(1 - progress, 5);
  return progress * progress * (3 - 2 * progress);
}

function rawLocalProgress(progress: number, config: PaintStrokeConfig) {
  return clamp01((progress - config.start) / (config.end - config.start));
}

function setParticleClusterStyles(element: SVGGElement, progress: number) {
  const clusterA = clamp01(progress / 0.58);
  const clusterB = clamp01((progress - 0.16) / 0.68);
  const clusterC = clamp01((progress - 0.34) / 0.66);

  element.style.setProperty("--cluster-a-opacity", clusterA.toFixed(4));
  element.style.setProperty("--cluster-b-opacity", clusterB.toFixed(4));
  element.style.setProperty("--cluster-c-opacity", clusterC.toFixed(4));
  element.style.setProperty(
    "--cluster-a-transform",
    `translate3d(${((1 - clusterA) * -16).toFixed(2)}px, ${((1 - clusterA) * 13).toFixed(2)}px, 0) scale(${(0.48 + clusterA * 0.52).toFixed(4)})`,
  );
  element.style.setProperty(
    "--cluster-b-transform",
    `translate3d(${((1 - clusterB) * 18).toFixed(2)}px, ${((1 - clusterB) * -10).toFixed(2)}px, 0) scale(${(0.42 + clusterB * 0.58).toFixed(4)})`,
  );
  element.style.setProperty(
    "--cluster-c-transform",
    `translate3d(${((1 - clusterC) * -9).toFixed(2)}px, ${((1 - clusterC) * -18).toFixed(2)}px, 0) scale(${(0.38 + clusterC * 0.62).toFixed(4)})`,
  );
}

function applyStrokeProgress(runtime: StrokeRuntime, progress: number) {
  const { config, element, lineElements, maskRect, maskPath } = runtime;
  const rawProgress = rawLocalProgress(progress, config);
  const revealProgress = ease(rawProgress, "smoothstep");
  const motionProgress = ease(rawProgress, config.easing);
  const usesRectMask = config.revealMode === "mask-ltr" || config.revealMode === "mask-rtl";
  const usesPathMask = config.revealMode === "mask-path";
  const usesLineReveal = config.revealMode === "line";
  const usesStaticArtwork = usesRectMask || usesPathMask || usesLineReveal;
  const transformProgress = usesStaticArtwork ? 1 : motionProgress;
  const inverse = 1 - transformProgress;

  element.style.setProperty("--stroke-progress", revealProgress.toFixed(4));
  element.style.setProperty("--stroke-motion-progress", motionProgress.toFixed(4));
  element.style.setProperty("--stroke-x", `${(config.translateX * inverse).toFixed(2)}px`);
  element.style.setProperty("--stroke-y", `${(config.translateY * inverse).toFixed(2)}px`);
  element.style.setProperty("--stroke-rotate", `${(config.rotateFrom * inverse).toFixed(3)}deg`);
  element.style.setProperty(
    "--stroke-scale",
    (config.scaleFrom + (1 - config.scaleFrom) * transformProgress).toFixed(4),
  );

  const targetOpacity = config.revealMode === "mist" ? motionProgress * 0.42 : motionProgress;
  element.style.setProperty(
    "--stroke-opacity",
    (
      usesRectMask || usesPathMask
        ? 1
        : usesLineReveal
          ? clamp01(revealProgress * 3)
          : targetOpacity
    ).toFixed(4),
  );

  if (maskRect) {
    const revealWidth = 1920 * revealProgress;
    const isRightToLeft = config.revealMode === "mask-rtl";
    maskRect.setAttribute("width", revealWidth.toFixed(2));
    maskRect.setAttribute(
      "x",
      (isRightToLeft ? 1920 - revealWidth : 0).toFixed(2),
    );
  }

  if (maskPath) {
    maskPath.style.strokeDashoffset = (1 - revealProgress).toFixed(4);
  }

  lineElements.forEach((line, index) => {
    const staggeredProgress = clamp01(
      (revealProgress - index * 0.055) / (1 - index * 0.055),
    );
    line.style.strokeDashoffset = (1 - staggeredProgress).toFixed(4);
  });

  if (config.revealMode === "particles") {
    setParticleClusterStyles(element, motionProgress);
  }
}

export function usePaintTakeover({ debug }: { debug: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const sectionElement: HTMLElement = section;
    const viewportElement = sectionElement.querySelector<HTMLElement>(
      "[data-takeover-viewport]",
    );
    if (!viewportElement) return undefined;
    const takeoverViewport: HTMLElement = viewportElement;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const runtimes = paintStrokeConfig.flatMap<StrokeRuntime>((config) => {
      const element = sectionElement.querySelector<SVGGElement>(`#${config.id}`);
      if (!element) return [];

      return [
        {
          config,
          element,
          lineElements: Array.from(
            element.querySelectorAll<SVGGeometryElement>("[data-line-reveal]"),
          ),
          maskRect: sectionElement.querySelector<SVGRectElement>(
            `[data-mask-for="${config.id}"]`,
          ),
          maskPath: sectionElement.querySelector<SVGPathElement>(
            `[data-mask-path-for="${config.id}"]`,
          ),
        },
      ];
    });

    const debugProgress = debug
      ? sectionElement.querySelector<HTMLElement>("[data-debug-progress]")
      : null;
    const debugPhase = debug
      ? sectionElement.querySelector<HTMLElement>("[data-debug-phase]")
      : null;
    const debugActive = debug
      ? sectionElement.querySelector<HTMLElement>("[data-debug-active]")
      : null;
    const debugReduced = debug
      ? sectionElement.querySelector<HTMLElement>("[data-debug-reduced]")
      : null;

    let animationFrame = 0;
    let lastPhase = "";
    let scrollDistance = 1;
    let geometryNeedsMeasurement = true;

    function measureGeometry() {
      scrollDistance = Math.max(
        sectionElement.offsetHeight - takeoverViewport.offsetHeight,
        1,
      );
      geometryNeedsMeasurement = false;
    }

    function update() {
      animationFrame = 0;

      const isReducedMotion = reducedMotionQuery.matches;
      if (geometryNeedsMeasurement) measureGeometry();

      const rect = sectionElement.getBoundingClientRect();
      const progress = isReducedMotion ? 1 : clamp01(-rect.top / scrollDistance);
      const phase = getPaintTakeoverPhase(progress);

      sectionElement.style.setProperty("--takeover-progress", progress.toFixed(4));
      sectionElement.style.setProperty(
        "--takeover-line-progress",
        clamp01((progress - 0.04) / 0.9).toFixed(4),
      );

      runtimes.forEach((runtime) => applyStrokeProgress(runtime, progress));

      if (phase !== lastPhase) {
        sectionElement.dataset.takeoverPhase = phase;
        lastPhase = phase;
      }

      if (debugProgress) debugProgress.textContent = progress.toFixed(4);
      if (debugPhase) debugPhase.textContent = phase;
      if (debugActive) {
        const visibleCount = paintStrokeConfig.filter(
          (config) => progress > config.start,
        ).length;
        debugActive.textContent = `${visibleCount} / ${paintStrokeConfig.length}`;
      }
      if (debugReduced) debugReduced.textContent = isReducedMotion ? "da" : "ne";

      sectionElement.dataset.paintReady = "true";
    }

    function scheduleUpdate() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(update);
    }

    function handleResize() {
      geometryNeedsMeasurement = true;
      scheduleUpdate();
    }

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", handleResize);
    reducedMotionQuery.addEventListener("change", scheduleUpdate);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", handleResize);
      reducedMotionQuery.removeEventListener("change", scheduleUpdate);
      delete sectionElement.dataset.paintReady;
      delete sectionElement.dataset.takeoverPhase;
      sectionElement.style.removeProperty("--takeover-progress");
      sectionElement.style.removeProperty("--takeover-line-progress");
    };
  }, [debug]);

  return sectionRef;
}
