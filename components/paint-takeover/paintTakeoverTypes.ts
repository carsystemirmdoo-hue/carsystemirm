export type FinalReviewMode =
  | "final"
  | "background"
  | "hero-static"
  | "hero-motion"
  | "text-contrast"
  | "mask-debug";

export type FinalHeroManifest = {
  topLevelGroups: number;
  mobileKeep: number;
  mobileHide: number;
  groups: Array<{
    id: string;
    family: string;
    origin: string;
    direction: string;
    depth: string;
    mobile: string;
    wave: string;
    start: number;
    end: number;
    revealMode: string;
    adaptationType: string;
  }>;
  finalStats: {
    bytes: number;
    paths: number;
    circles: number;
    ellipses: number;
    groups: number;
    masks: number;
    filters: number;
    totalSvgDomElements: number;
  };
};

export type PaintTakeoverDebugSnapshot = {
  progress: number;
  phase: string;
  activeGroups: number;
  viewportWidth: number;
  reducedMotion: boolean;
};

export type PaintTakeoverState =
  | "before"
  | "entering"
  | "active"
  | "leaving"
  | "after";

export type PaintTakeoverDirection = "idle" | "down" | "up";

export type PaintTakeoverRuntimeSnapshot = {
  timestamp: number;
  progress: number;
  direction: PaintTakeoverDirection;
  rectTop: number;
  rectBottom: number;
  stickyActive: boolean;
  state: PaintTakeoverState;
  htmlAttribute: string | null;
  colorWashOpacity: number;
  headerVariant: "base" | "takeover";
  washDisabled: boolean;
  reducedMotion: boolean;
  activeRafCallbacks: number;
};

export type PaintTakeoverMutationLog = {
  timestamp: number;
  attribute: string;
  oldValue: string | null;
  newValue: string | null;
  progress: number;
  direction: PaintTakeoverDirection;
};
