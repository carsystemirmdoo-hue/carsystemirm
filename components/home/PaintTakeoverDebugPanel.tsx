"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  PaintTakeoverMutationLog,
  PaintTakeoverRuntimeSnapshot,
} from "@/components/paint-takeover/paintTakeoverTypes";
import styles from "./PaintTakeoverDebugPanel.module.css";

const WATCHED_ATTRIBUTES = [
  "data-paint-takeover",
  "data-theme",
  "class",
  "data-paint-chapter",
];

type PaintTakeoverDebugPanelProps = {
  snapshot: PaintTakeoverRuntimeSnapshot | null;
};

type PaintLayoutSnapshot = {
  bridgeParent: string;
  partnersTop: number;
  partnersBottom: number;
  bridgeTop: number;
  bridgeBottom: number;
  takeoverTop: number;
  takeoverBottom: number;
  zIndices: string;
};

function formatNumber(value: number | undefined, decimals = 4) {
  return value === undefined ? "—" : value.toFixed(decimals);
}

export function PaintTakeoverDebugPanel({
  snapshot,
}: PaintTakeoverDebugPanelProps) {
  const latestSnapshotRef = useRef(snapshot);
  const [lastMutation, setLastMutation] =
    useState<PaintTakeoverMutationLog | null>(null);
  const [layoutSnapshot, setLayoutSnapshot] =
    useState<PaintLayoutSnapshot | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    latestSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const partners = document.querySelector<HTMLElement>(
        "#prodavnice-mreza",
      );
      const background = document.querySelector<HTMLElement>(
        "[data-partners-background]",
      );
      const bridge = document.querySelector<HTMLElement>(
        "[data-paint-entry-bridge]",
      );
      const locator = document.querySelector<HTMLElement>(
        "[data-locator-card]",
      );
      const map = document.querySelector<HTMLElement>("[data-map-wrapper]");
      const takeover =
        document.querySelector<HTMLElement>("#paint-takeover");
      if (!partners || !bridge || !takeover) return;

      const partnersRect = partners.getBoundingClientRect();
      const bridgeRect = bridge.getBoundingClientRect();
      const takeoverRect = takeover.getBoundingClientRect();
      const zIndexFor = (element: HTMLElement | null) =>
        element ? getComputedStyle(element).zIndex : "—";

      setLayoutSnapshot({
        bridgeParent: bridge.parentElement?.id
          ? `#${bridge.parentElement.id}`
          : (bridge.parentElement?.tagName.toLowerCase() ?? "—"),
        partnersTop: partnersRect.top,
        partnersBottom: partnersRect.bottom,
        bridgeTop: bridgeRect.top,
        bridgeBottom: bridgeRect.bottom,
        takeoverTop: takeoverRect.top,
        takeoverBottom: takeoverRect.bottom,
        zIndices: `partners ${zIndexFor(partners)} · bg ${zIndexFor(background)} · bridge ${zIndexFor(bridge)} · locator ${zIndexFor(locator)} · map ${zIndexFor(map)} · takeover ${zIndexFor(takeover)}`,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [snapshot]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const root = document.documentElement;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.type !== "attributes" ||
          !record.attributeName ||
          !WATCHED_ATTRIBUTES.includes(record.attributeName)
        ) {
          continue;
        }

        const current = latestSnapshotRef.current;
        const debugSection =
          document.querySelector<HTMLElement>("#paint-takeover");
        const progress = Number(
          debugSection?.dataset.paintDebugProgress ??
            current?.progress ??
            0,
        );
        const debugDirection =
          debugSection?.dataset.paintDebugDirection;
        const direction =
          debugDirection === "down" ||
          debugDirection === "up" ||
          debugDirection === "idle"
            ? debugDirection
            : (current?.direction ?? "idle");
        const entry: PaintTakeoverMutationLog = {
          timestamp: performance.now(),
          attribute: record.attributeName,
          oldValue: record.oldValue,
          newValue: root.getAttribute(record.attributeName),
          progress,
          direction,
        };

        setLastMutation(entry);
        console.info(
          "[paint-debug:html-mutation]",
          JSON.stringify(entry),
        );
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: WATCHED_ATTRIBUTES,
    });

    return () => observer.disconnect();
  }, []);

  const panel = (
    <aside className={styles.panel} aria-label="Paint takeover diagnostics">
      <p className={styles.title}>PAINT DIAGNOSTIKA</p>
      <dl className={styles.grid}>
        <dt>Progress</dt>
        <dd>{formatNumber(snapshot?.progress)}</dd>
        <dt>Smer</dt>
        <dd>{snapshot?.direction ?? "—"}</dd>
        <dt>Rect top / bottom</dt>
        <dd>
          {formatNumber(snapshot?.rectTop, 1)} /{" "}
          {formatNumber(snapshot?.rectBottom, 1)}
        </dd>
        <dt>Sticky aktivan</dt>
        <dd>{snapshot ? (snapshot.stickyActive ? "da" : "ne") : "—"}</dd>
        <dt>State</dt>
        <dd>{snapshot?.state ?? "—"}</dd>
        <dt>html paintTakeover</dt>
        <dd>{snapshot?.htmlAttribute ?? "—"}</dd>
        <dt>Color wash</dt>
        <dd>{formatNumber(snapshot?.colorWashOpacity)}</dd>
        <dt>Wash dijagnostika</dt>
        <dd>{snapshot?.washDisabled ? "OFF" : "ON"}</dd>
        <dt>Header varijanta</dt>
        <dd>{snapshot?.headerVariant ?? "—"}</dd>
        <dt>Reduced motion</dt>
        <dd>{snapshot ? (snapshot.reducedMotion ? "da" : "ne") : "—"}</dd>
        <dt>Aktivni RAF</dt>
        <dd>{snapshot?.activeRafCallbacks ?? "—"}</dd>
        <dt>Bridge parent</dt>
        <dd>{layoutSnapshot?.bridgeParent ?? "—"}</dd>
        <dt>Partners top / bottom</dt>
        <dd>
          {formatNumber(layoutSnapshot?.partnersTop, 1)} /{" "}
          {formatNumber(layoutSnapshot?.partnersBottom, 1)}
        </dd>
        <dt>Bridge top / bottom</dt>
        <dd>
          {formatNumber(layoutSnapshot?.bridgeTop, 1)} /{" "}
          {formatNumber(layoutSnapshot?.bridgeBottom, 1)}
        </dd>
        <dt>Takeover top / bottom</dt>
        <dd>
          {formatNumber(layoutSnapshot?.takeoverTop, 1)} /{" "}
          {formatNumber(layoutSnapshot?.takeoverBottom, 1)}
        </dd>
        <dt>Z-index</dt>
        <dd>{layoutSnapshot?.zIndices ?? "—"}</dd>
      </dl>
      <div className={styles.mutation}>
        <span>Poslednja html mutacija</span>
        <strong>
          {lastMutation
            ? `${lastMutation.timestamp.toFixed(1)}ms · ${lastMutation.attribute}: ${lastMutation.oldValue ?? "∅"} → ${lastMutation.newValue ?? "∅"}`
            : "nema"}
        </strong>
      </div>
    </aside>
  );

  return portalTarget ? createPortal(panel, portalTarget) : null;
}
