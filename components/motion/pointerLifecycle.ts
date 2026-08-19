/**
 * Tipizovan omotač nad `pointerLifecycle.mjs`.
 *
 * Implementacija je u `.mjs` da je `node --test` vozi bez build koraka. Ovde su
 * samo tipovi — drugi globalni pointer lifecycle se ne sme dodati.
 */
import {
  getPointerLifecycleStats as getStatsImpl,
  registerPointerConsumer as registerImpl,
} from "./pointerLifecycle.mjs";

export type PointerResetReason =
  | "pointercancel"
  | "pointerleave"
  | "blur"
  | "hidden"
  | "pagehide";

export type PointerPoint = { x: number; y: number };

export type PointerConsumerHandlers = {
  /** Miš se pomerio; koordinate su uvek poslednje viđene. */
  onPointerMove?: (event: PointerEvent) => void;
  onPointerOut?: (event: PointerEvent) => void;
  /**
   * Cilj ispod (nepomičnog) kursora se možda promenio — skrol, boundary
   * događaj, izmena DOM-a. Poziva se najviše jednom po frame-u.
   */
  onPointerRefresh?: (point: PointerPoint) => void;
  /** Povratak u neutralno stanje: cancel, izlazak iz prozora, blur, hidden. */
  onReset?: (reason: PointerResetReason) => void;
  /** Zajednički animacioni frame, samo posle `requestFrame()`. */
  onFrame?: () => void;
};

export type PointerConsumerRegistration = {
  requestFrame: () => void;
  cancelFrame: () => void;
  lastPoint: () => PointerPoint | null;
  release: () => void;
};

/**
 * DOM površina huba. Injektabilna da se ugovor vozi nad duplerom u `node --test`.
 */
export type PointerLifecycleEnvironment = {
  document: Pick<
    Document,
    "addEventListener" | "removeEventListener" | "visibilityState"
  >;
  window: Pick<
    Window,
    | "addEventListener"
    | "removeEventListener"
    | "requestAnimationFrame"
    | "cancelAnimationFrame"
  >;
};

export function registerPointerConsumer(
  handlers: PointerConsumerHandlers,
  environment?: PointerLifecycleEnvironment,
): PointerConsumerRegistration | null {
  return registerImpl(
    handlers,
    environment,
  ) as PointerConsumerRegistration | null;
}

/** Test-only pogled na živo stanje huba. */
export function getPointerLifecycleStats(
  environment: PointerLifecycleEnvironment,
): {
  installed: boolean;
  consumers: number;
  scheduledFrame: boolean;
  frameRequests: number;
} {
  return getStatsImpl(environment) as {
    installed: boolean;
    consumers: number;
    scheduledFrame: boolean;
    frameRequests: number;
  };
}
