"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import {
  getProductVisualPreset,
  getProductVisualStyle,
} from "@/components/product/productMotion";
import { nextRevealDirection } from "@/components/product/productRevealDirection.mjs";
import { resetLocalPointerVars } from "@/components/motion/useLocalPointerVars";
import styles from "./ProductVisualSurface.module.css";

type ProductInteractionPhase = "idle" | "active" | "exiting";
type RevealDirection = "top" | "bottom";

const EXIT_FALLBACK_MS = 520;

function getDevelopmentDirectionOverride(): RevealDirection | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const hashDirection = window.location.hash.replace(/^#(?:revealDirection=)?/, "");
  const direction =
    document.documentElement.dataset.revealDirection ??
    new URLSearchParams(window.location.search).get("revealDirection") ??
    hashDirection;
  return direction === "top" || direction === "bottom" ? direction : null;
}

function updateSurfacePointerMotion(
  surface: HTMLElement,
  event: globalThis.PointerEvent,
) {
  const rect = surface.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const x = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
  const y = Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100);
  const shiftX = (x - 50) * 0.045;
  const shiftY = (y - 50) * 0.035;
  const tiltX = (50 - y) * 0.018;
  const tiltY = (x - 50) * 0.018;

  surface.style.setProperty("--product-visual-pointer-x", `${x.toFixed(2)}%`);
  surface.style.setProperty("--product-visual-pointer-y", `${y.toFixed(2)}%`);
  surface.style.setProperty("--product-visual-motion-x", `${shiftX.toFixed(2)}px`);
  surface.style.setProperty("--product-visual-motion-y", `${shiftY.toFixed(2)}px`);
  surface.style.setProperty("--product-visual-tilt-x", `${tiltX.toFixed(2)}deg`);
  surface.style.setProperty("--product-visual-tilt-y", `${tiltY.toFixed(2)}deg`);
}

function resetSurfacePointerMotion(surface: HTMLElement) {
  surface.style.setProperty("--product-visual-pointer-x", "50%");
  surface.style.setProperty("--product-visual-pointer-y", "50%");
  surface.style.setProperty("--product-visual-motion-x", "0px");
  surface.style.setProperty("--product-visual-motion-y", "0px");
  surface.style.setProperty("--product-visual-tilt-x", "0deg");
  surface.style.setProperty("--product-visual-tilt-y", "0deg");
}

export function ProductVisualSurface({
  brandName,
  className,
  image,
  priority = false,
  product,
  sizes,
}: {
  brandName: string;
  className?: string;
  image?: ProductImageAsset | null;
  priority?: boolean;
  product: CarsystemProduct;
  sizes: string;
}) {
  const selectedImage = image ?? product.productImage ?? product.galleryImages[0] ?? null;
  const hasProductAsset = Boolean(
    selectedImage && !selectedImage.src.includes("placeholder-product"),
  );
  const visual = getProductVisualPreset(product);
  const [interactionPhase, setInteractionPhase] =
    useState<ProductInteractionPhase>("idle");
  const [revealDirection, setRevealDirection] = useState<RevealDirection>("top");
  const [isSurfacePointerActive, setIsSurfacePointerActive] = useState(false);
  const surfaceRef = useRef<HTMLSpanElement | null>(null);
  const interactionRootRef = useRef<HTMLElement | null>(null);
  const interactionPhaseRef = useRef<ProductInteractionPhase>("idle");
  const pointerSessionRef = useRef(false);
  const focusSessionRef = useRef(false);
  const touchPointerIdRef = useRef<number | null>(null);
  const stationaryPointerSuppressedRef = useRef(false);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const surfaceClassName = [styles.surface, className].filter(Boolean).join(" ");

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current === null) return;
    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }, []);

  const completeExit = useCallback(() => {
    clearExitTimer();
    interactionPhaseRef.current = "idle";
    setInteractionPhase("idle");
    setIsSurfacePointerActive(false);
  }, [clearExitTimer]);

  const resetPointerMotion = useCallback(() => {
    const surface = surfaceRef.current;
    if (surface) resetSurfacePointerMotion(surface);

    const interactionRoot = interactionRootRef.current;
    if (interactionRoot && interactionRoot !== surface) {
      resetLocalPointerVars(interactionRoot, true);
    }
  }, []);

  const activateInteraction = useCallback(() => {
    clearExitTimer();

    if (interactionPhaseRef.current === "idle" && visual.visualMode === "color-on-hover") {
      const selectedDirection =
        getDevelopmentDirectionOverride() ?? nextRevealDirection(product.slug);
      setRevealDirection(selectedDirection);
    }

    interactionPhaseRef.current = "active";
    setInteractionPhase("active");
    setIsSurfacePointerActive(true);
  }, [clearExitTimer, product.slug, visual.visualMode]);

  const beginExit = useCallback(() => {
    if (interactionPhaseRef.current === "idle" || interactionPhaseRef.current === "exiting") {
      return;
    }

    interactionPhaseRef.current = "exiting";
    setInteractionPhase("exiting");
    setIsSurfacePointerActive(false);
    resetPointerMotion();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      completeExit();
      return;
    }

    clearExitTimer();
    exitTimerRef.current = window.setTimeout(completeExit, EXIT_FALLBACK_MS);
  }, [clearExitTimer, completeExit, resetPointerMotion]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const activeSurface = surface;

    const interactionRoot =
      activeSurface.closest<HTMLElement>(".cs-product-motion-card") ?? activeSurface;
    interactionRootRef.current = interactionRoot;
    resetSurfacePointerMotion(activeSurface);

    function noInteractionSourceRemains() {
      return (
        !pointerSessionRef.current &&
        !focusSessionRef.current &&
        touchPointerIdRef.current === null
      );
    }

    function exitWhenInactive() {
      if (noInteractionSourceRemains()) beginExit();
    }

    function pointerEventShowsNewMovement(event: globalThis.PointerEvent) {
      const lastPosition = lastPointerPositionRef.current;
      const moved =
        lastPosition === null ||
        Math.abs(event.clientX - lastPosition.x) > 0.5 ||
        Math.abs(event.clientY - lastPosition.y) > 0.5;

      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };

      if (!stationaryPointerSuppressedRef.current) return true;
      if (!moved) return false;

      stationaryPointerSuppressedRef.current = false;
      return true;
    }

    function handlePointerEnter(event: globalThis.PointerEvent) {
      if (event.pointerType === "touch") return;
      if (!pointerEventShowsNewMovement(event)) return;
      if (
        event.relatedTarget instanceof Node &&
        interactionRoot.contains(event.relatedTarget)
      ) {
        return;
      }

      pointerSessionRef.current = true;
      updateSurfacePointerMotion(activeSurface, event);
      activateInteraction();
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (event.pointerType === "touch") return;
      if (!pointerEventShowsNewMovement(event)) return;
      updateSurfacePointerMotion(activeSurface, event);

      if (!pointerSessionRef.current) {
        pointerSessionRef.current = true;
        activateInteraction();
      }
    }

    function handlePointerLeave(event: globalThis.PointerEvent) {
      if (
        event.relatedTarget instanceof Node &&
        interactionRoot.contains(event.relatedTarget)
      ) {
        return;
      }

      pointerSessionRef.current = false;
      exitWhenInactive();
    }

    function handlePointerDown(event: globalThis.PointerEvent) {
      if (event.pointerType !== "touch" || touchPointerIdRef.current !== null) return;
      stationaryPointerSuppressedRef.current = false;
      touchPointerIdRef.current = event.pointerId;
      updateSurfacePointerMotion(activeSurface, event);
      activateInteraction();
    }

    function finishTouchPointer(event: globalThis.PointerEvent) {
      if (touchPointerIdRef.current !== event.pointerId) return;
      touchPointerIdRef.current = null;
      exitWhenInactive();
    }

    function handlePointerCancel(event: globalThis.PointerEvent) {
      if (event.pointerType === "touch") {
        finishTouchPointer(event);
        return;
      }

      pointerSessionRef.current = false;
      exitWhenInactive();
    }

    function handleFocusIn(event: FocusEvent) {
      if (
        event.relatedTarget instanceof Node &&
        interactionRoot.contains(event.relatedTarget)
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      focusSessionRef.current = true;
      activateInteraction();
    }

    function handleFocusOut(event: FocusEvent) {
      if (
        event.relatedTarget instanceof Node &&
        interactionRoot.contains(event.relatedTarget)
      ) {
        return;
      }

      focusSessionRef.current = false;
      exitWhenInactive();
    }

    function forceInteractionCleanup() {
      pointerSessionRef.current = false;
      focusSessionRef.current = false;
      touchPointerIdRef.current = null;
      stationaryPointerSuppressedRef.current = true;
      resetPointerMotion();
      beginExit();
    }

    function handleScroll() {
      pointerSessionRef.current = false;
      touchPointerIdRef.current = null;
      stationaryPointerSuppressedRef.current = true;
      resetPointerMotion();
      exitWhenInactive();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") forceInteractionCleanup();
    }

    function handleWindowFocus() {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        interactionRoot.contains(activeElement)
      ) {
        focusSessionRef.current = true;
        activateInteraction();
      }
    }

    const pointerStateObserver =
      interactionRoot === activeSurface
        ? null
        : new MutationObserver(() => {
            if (interactionRoot.dataset.pointerActive === "true") {
              if (stationaryPointerSuppressedRef.current) return;
              if (!pointerSessionRef.current) {
                pointerSessionRef.current = true;
                activateInteraction();
              }
              return;
            }

            if (pointerSessionRef.current) {
              pointerSessionRef.current = false;
              exitWhenInactive();
            }
          });

    pointerStateObserver?.observe(interactionRoot, {
      attributes: true,
      attributeFilter: ["data-pointer-active"],
    });

    interactionRoot.addEventListener("pointerenter", handlePointerEnter);
    interactionRoot.addEventListener("pointermove", handlePointerMove, { passive: true });
    interactionRoot.addEventListener("pointerleave", handlePointerLeave);
    interactionRoot.addEventListener("pointerdown", handlePointerDown, { passive: true });
    interactionRoot.addEventListener("focusin", handleFocusIn);
    interactionRoot.addEventListener("focusout", handleFocusOut);
    document.addEventListener("pointerup", finishTouchPointer, { passive: true });
    document.addEventListener("pointercancel", handlePointerCancel, { passive: true });
    document.addEventListener("lostpointercapture", handlePointerCancel, true);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", forceInteractionCleanup);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pagehide", forceInteractionCleanup);

    return () => {
      pointerStateObserver?.disconnect();
      interactionRoot.removeEventListener("pointerenter", handlePointerEnter);
      interactionRoot.removeEventListener("pointermove", handlePointerMove);
      interactionRoot.removeEventListener("pointerleave", handlePointerLeave);
      interactionRoot.removeEventListener("pointerdown", handlePointerDown);
      interactionRoot.removeEventListener("focusin", handleFocusIn);
      interactionRoot.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("pointerup", finishTouchPointer);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("lostpointercapture", handlePointerCancel, true);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", forceInteractionCleanup);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pagehide", forceInteractionCleanup);
      clearExitTimer();
      resetSurfacePointerMotion(activeSurface);
      if (interactionRoot !== activeSurface) resetLocalPointerVars(interactionRoot, true);
      interactionRootRef.current = null;
      interactionPhaseRef.current = "idle";
      pointerSessionRef.current = false;
      focusSessionRef.current = false;
      touchPointerIdRef.current = null;
      stationaryPointerSuppressedRef.current = false;
      lastPointerPositionRef.current = null;
    };
  }, [activateInteraction, beginExit, clearExitTimer, resetPointerMotion]);

  function handleRevealTransitionEnd(event: ReactTransitionEvent<HTMLSpanElement>) {
    if (
      event.target === event.currentTarget &&
      event.propertyName === "transform" &&
      interactionPhaseRef.current === "exiting"
    ) {
      completeExit();
    }
  }

  return (
    <span
      ref={surfaceRef}
      className={surfaceClassName}
      data-product-image-motion
      data-product-visual-real-image={hasProductAsset ? "true" : "false"}
      data-product-visual-pointer-active={isSurfacePointerActive ? "true" : undefined}
      data-product-visual-surface
      data-product-visual-treatment={visual.treatment}
      data-product-visual-type={visual.productType}
      data-product-visual-mode={visual.visualMode}
      data-product-visual-state={interactionPhase}
      data-reveal-direction={`from-${revealDirection}`}
      style={getProductVisualStyle(product)}
    >
      <span className={styles.baseLayer} aria-hidden="true" />
      <span
        className={styles.colorReveal}
        aria-hidden="true"
        onTransitionEnd={handleRevealTransitionEnd}
      />
      <span className={styles.effectStack} aria-hidden="true">
        <span className={styles.effectPane}>
          <span className={styles.effectInner}>
            <span className={styles.floodWash} />
            <span className={styles.floodCore} />
            <span className={styles.matteField} />
            <span className={styles.matteGrain} />
            <span className={styles.abrasiveWash} />
            <span className={styles.abrasiveTrace} />
            <span className={styles.polishSheen} />
            <span className={styles.polishSweep} />
          </span>
        </span>
        <span className={styles.rollerEdge} />
      </span>
      <span className={styles.contactShadow} aria-hidden="true" />

      <span className={styles.brandMark}>{brandName}</span>

      <span className={styles.objectWrap}>
        {hasProductAsset && selectedImage ? (
          <Image
            src={selectedImage.src}
            alt={selectedImage.alt}
            fill
            sizes={sizes}
            className={styles.productImage}
            priority={priority}
          />
        ) : (
          <span className={styles.placeholderVisual} aria-hidden="true">
            <span className={styles.placeholderMark} />
            <small>Vizuel u pripremi</small>
            <strong>{brandName}</strong>
            <span>{product.name}</span>
          </span>
        )}
      </span>
      <span className={styles.pointerLens} aria-hidden="true" />
    </span>
  );
}
