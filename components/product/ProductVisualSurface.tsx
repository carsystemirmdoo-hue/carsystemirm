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
  toProductVisualPresentation,
  type ProductVisualPresentation,
} from "@/components/product/productVisualPresentation";
import { nextRevealDirection } from "@/components/product/productRevealDirection.mjs";
import { useProductImageLoadState } from "@/components/product/useProductImageLoadState";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import fit from "./ProductImageFit.generated.module.css";
import { resetLocalPointerVars } from "@/components/motion/useLocalPointerVars";
import {
  registerProductSurface,
  type ProductSurfaceRegistration,
} from "@/components/motion/productSurfaceLifecycle";
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

/**
 * Accepts either a full `CarsystemProduct` (PDP, brand pages, related rows) or a
 * pre-resolved `presentation` (catalog cards).
 *
 * The catalog path exists because this is a client component: passing the rich
 * product here re-serialised the whole record into the RSC payload once per
 * rendered card. The rendered markup is identical either way — the presentation
 * is produced by the same two helpers this component would otherwise call.
 */
export function ProductVisualSurface({
  brandName,
  className,
  image,
  presentation,
  priority = false,
  product,
  sizes,
}: {
  brandName: string;
  className?: string;
  image?: ProductImageAsset | null;
  presentation?: ProductVisualPresentation;
  priority?: boolean;
  product?: CarsystemProduct;
  sizes: string;
}) {
  const resolved: ProductVisualPresentation =
    presentation ??
    toProductVisualPresentation(
      product as CarsystemProduct,
      image ?? undefined,
    );
  const identityImage = image ?? resolved.image;
  // Kartica crta pregledan derivat za prikaz (lib/productImageDisplay.ts), ako postoji.
  const selectedImage = identityImage
    ? { ...identityImage, src: toDisplayImageSrc(identityImage.src) }
    : identityImage;
  const hasRealImage = Boolean(
    selectedImage && !selectedImage.src.includes("placeholder-product"),
  );
  /*
   * Slika koja ne uspe da se učita prelazi u isti pošten prikaz kao proizvod bez
   * slike („Vizuel u pripremi"), umesto slomljene ikone ili — u tamnoj temi —
   * prazne ploče u boji studijske pozadine.
   */
  const { ref: imageRef, state: imageState } = useProductImageLoadState(
    hasRealImage ? selectedImage?.src : null,
  );
  const hasProductAsset = hasRealImage && imageState !== "failed";
  /*
   * V6 (fit po subjektu + tačno jedna senka) važi samo kada je server upisao
   * `officialShadow` za BAŠ OVU sliku (izmerenu na fajlu koji se crta — derivat
   * za prikaz, ako postoji). `image` prop menja sliku posle odluke servera
   * (galerija), pa tada ostaje legacy — merenje pripada drugoj slici.
   *
   * Stanje učitavanja je ISTO ono iznad (jedan izvor istine): V6 ga samo
   * izlaže kao atribut, da CSS senku crta tek za `loaded`. Slika koja padne
   * zadržava V6 atribute sa `failed`, pa ni njen „Vizuel u pripremi" nema senku.
   */
  const v6Shadow =
    hasRealImage && !image ? (resolved.officialShadow ?? null) : null;
  const visual = {
    treatment: resolved.treatment,
    productType: resolved.productType,
    visualMode: resolved.visualMode,
  };
  const productSize = { volumeStatus: resolved.volumeStatus };
  const sizeClass = resolved.sizeClass;
  const quantityLabel = resolved.quantityLabel;
  const productSlug = resolved.slug;
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
  const registrationRef = useRef<ProductSurfaceRegistration | null>(null);
  /*
   * `fit.fit` publishes this image's content box as custom properties (see
   * `ProductImageFit.generated.module.css`). It is a stylesheet rather than a
   * lookup the component could call because the catalog renders its cards from
   * a client component: a table covering all 826 renders would otherwise have
   * to ship as JavaScript. An image with no rule falls back to canvas-fit, so
   * SVG illustrations and placeholders keep their previous behaviour.
   */
  const surfaceClassName = [styles.surface, fit.fit, className]
    .filter(Boolean)
    .join(" ");

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
    // Idle instanca izlazi iz hub dispatch skupa — scroll i pointercancel je
    // više ne dodiruju dok se ponovo ne aktivira.
    registrationRef.current?.setActive(false);
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
        getDevelopmentDirectionOverride() ?? nextRevealDirection(productSlug);
      setRevealDirection(selectedDirection);
    }

    interactionPhaseRef.current = "active";
    setInteractionPhase("active");
    setIsSurfacePointerActive(true);
    registrationRef.current?.setActive(true);
  }, [clearExitTimer, productSlug, visual.visualMode]);

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
      registrationRef.current?.setTouchPointerId(event.pointerId);
      updateSurfacePointerMotion(activeSurface, event);
      activateInteraction();
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
      registrationRef.current?.setTouchPointerId(null);
      stationaryPointerSuppressedRef.current = true;
      resetPointerMotion();
      beginExit();
    }

    function handleScroll() {
      pointerSessionRef.current = false;
      touchPointerIdRef.current = null;
      registrationRef.current?.setTouchPointerId(null);
      stationaryPointerSuppressedRef.current = true;
      resetPointerMotion();
      exitWhenInactive();
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

    /*
     * Globalni deo lifecycle-a je zajednički za sve surface instance na
     * dokumentu (jedan listener po događaju, jedan MutationObserver ukupno).
     * Hub prosleđuje događaj samo instanci koja može da reaguje, pa scroll bez
     * aktivne kartice ne radi ništa po kartici.
     */
    registrationRef.current =
      interactionRoot === activeSurface
        ? null
        : registerProductSurface(interactionRoot, {
            onTouchPointerRelease() {
              const pointerId = touchPointerIdRef.current;
              if (pointerId === null) return;
              touchPointerIdRef.current = null;
              registrationRef.current?.setTouchPointerId(null);
              exitWhenInactive();
            },
            onPointerCancel() {
              pointerSessionRef.current = false;
              exitWhenInactive();
            },
            onScroll: handleScroll,
            onForceCleanup: forceInteractionCleanup,
            onWindowFocus: handleWindowFocus,
            onPointerActiveChange() {
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
            },
          });

    interactionRoot.addEventListener("pointerenter", handlePointerEnter);
    interactionRoot.addEventListener("pointermove", handlePointerMove, { passive: true });
    interactionRoot.addEventListener("pointerleave", handlePointerLeave);
    interactionRoot.addEventListener("pointerdown", handlePointerDown, { passive: true });
    interactionRoot.addEventListener("focusin", handleFocusIn);
    interactionRoot.addEventListener("focusout", handleFocusOut);

    return () => {
      registrationRef.current?.release();
      registrationRef.current = null;
      interactionRoot.removeEventListener("pointerenter", handlePointerEnter);
      interactionRoot.removeEventListener("pointermove", handlePointerMove);
      interactionRoot.removeEventListener("pointerleave", handlePointerLeave);
      interactionRoot.removeEventListener("pointerdown", handlePointerDown);
      interactionRoot.removeEventListener("focusin", handleFocusIn);
      interactionRoot.removeEventListener("focusout", handleFocusOut);
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
      data-product-fit={hasProductAsset ? selectedImage?.src : undefined}
      data-product-fit-model={v6Shadow ? "v6" : undefined}
      data-product-shadow-model={v6Shadow ? "v6" : undefined}
      data-product-official-shadow={v6Shadow ?? undefined}
      data-product-image-state={v6Shadow ? imageState : undefined}
      data-product-visual-real-image={hasProductAsset ? "true" : "false"}
      data-product-visual-pointer-active={isSurfacePointerActive ? "true" : undefined}
      data-product-visual-surface
      data-product-visual-treatment={visual.treatment}
      data-product-visual-type={visual.productType}
      data-product-visual-mode={visual.visualMode}
      data-product-visual-state={interactionPhase}
      data-product-size-class={sizeClass}
      data-reveal-direction={`from-${revealDirection}`}
      style={resolved.style}
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
            ref={imageRef}
            src={selectedImage.src}
            alt={selectedImage.alt}
            fill
            sizes={sizes}
            className={styles.productImage}
            priority={priority}
          />
        ) : (
          <span
            className={styles.placeholderVisual}
            data-product-visual-placeholder
            aria-hidden="true"
          >
            <span className={styles.placeholderMark} />
            <small>Vizuel u pripremi</small>
            <strong>{brandName}</strong>
            <span>{resolved.name}</span>
          </span>
        )}
      </span>

      {quantityLabel ? (
        <span className={styles.quantityBadge} data-status={productSize.volumeStatus}>
          <span className={styles.quantityBadgeRule} aria-hidden="true" />
          {quantityLabel}
        </span>
      ) : null}
      <span className={styles.pointerLens} aria-hidden="true" />
    </span>
  );
}
