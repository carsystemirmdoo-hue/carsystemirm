/**
 * Tipizovan omotač nad `pigmentCursorRuntime.mjs`.
 *
 * Implementacija je u `.mjs` zbog `node --test`; ovde su samo tipovi.
 */
import {
  createPigmentCursorRuntime as createImpl,
  CURSOR_ENABLED_CLASS as CURSOR_ENABLED_CLASS_IMPL,
  NEUTRAL_STATE as NEUTRAL_STATE_IMPL,
} from "./pigmentCursorRuntime.mjs";
import type { PointerLifecycleEnvironment, PointerPoint } from "./pointerLifecycle";

export const CURSOR_ENABLED_CLASS: string = CURSOR_ENABLED_CLASS_IMPL;
export const NEUTRAL_STATE: string = NEUTRAL_STATE_IMPL;

export type PigmentCursorState = {
  state: string;
  process: string;
  /** Čvor na kome hover stanje visi; `isConnected` ga obara kad nestane. */
  element: { isConnected?: boolean } | null;
};

export type PigmentCursorElement = {
  dataset: Record<string, string>;
  style: { transform: string };
};

export type PigmentCursorEnvironment = PointerLifecycleEnvironment & {
  matchMedia: (query: string) => {
    matches: boolean;
    addEventListener: (type: "change", listener: () => void) => void;
    removeEventListener: (type: "change", listener: () => void) => void;
  };
  bodyClassList: { add: (name: string) => void; remove: (name: string) => void };
  resolveStateFromEvent: (event: PointerEvent) => PigmentCursorState;
  resolveStateFromPoint: (point: PointerPoint) => PigmentCursorState;
  viewportCenter?: () => PointerPoint;
};

export type PigmentCursorRuntime = {
  destroy: () => void;
  stats: () => {
    enabled: boolean;
    visible: boolean;
    stateKey: string;
    hoverElement: unknown;
    target: PointerPoint;
    haloPosition: PointerPoint;
    dotPosition: PointerPoint;
  };
};

export function createPigmentCursorRuntime(options: {
  halo: PigmentCursorElement;
  dot: PigmentCursorElement;
  env: PigmentCursorEnvironment;
  mediaQuery?: string;
}): PigmentCursorRuntime {
  return createImpl(options) as PigmentCursorRuntime;
}
