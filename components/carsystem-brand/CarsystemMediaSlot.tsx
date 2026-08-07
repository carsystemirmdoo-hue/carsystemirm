"use client";

import { useState, type CSSProperties } from "react";
import type {
  CarsystemMediaAvailability,
  CarsystemMediaDefinition,
} from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

type CarsystemMediaSlotProps = {
  availability: CarsystemMediaAvailability[CarsystemMediaDefinition["id"]];
  className?: string;
  media: CarsystemMediaDefinition;
  priority?: boolean;
  sizes?: string;
};

function getFilename(src: string) {
  return src.split("/").at(-1) ?? src;
}

export function CarsystemMediaSlot({
  availability,
  className,
  media,
  priority = false,
  sizes = "(min-width: 64rem) 52vw, 100vw",
}: CarsystemMediaSlotProps) {
  const [failed, setFailed] = useState(false);
  const hasDesktopAsset = availability.desktop && !failed;
  const hasMobileAsset = Boolean(
    media.mobileSrc && availability.mobile && !failed,
  );
  const mobileWidth = media.mobileWidth ?? media.width;
  const mobileHeight = media.mobileHeight ?? media.height;
  const showDevelopmentLabel = process.env.NODE_ENV !== "production";

  return (
    <figure
      className={`${styles.mediaSlot}${className ? ` ${className}` : ""}`}
      data-has-asset={hasDesktopAsset || undefined}
      data-variant={media.variant}
      style={
        {
          "--cs-media-ratio": `${media.width} / ${media.height}`,
          "--cs-media-mobile-ratio": `${mobileWidth} / ${mobileHeight}`,
        } as CSSProperties
      }
    >
      {hasDesktopAsset ? (
        <picture>
          {hasMobileAsset ? (
            <source media="(max-width: 47.99rem)" srcSet={media.mobileSrc} />
          ) : null}
          <img
            src={media.desktopSrc}
            alt={media.alt}
            width={media.width}
            height={media.height}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            loading={priority ? "eager" : "lazy"}
            sizes={sizes}
            onError={() => setFailed(true)}
          />
        </picture>
      ) : (
        <div
          className={styles.mediaFallback}
          role="img"
          aria-label={media.alt}
        >
          <WorkshopSchematic variant={media.variant} />
          {showDevelopmentLabel ? (
            <small className={styles.mediaDevelopmentLabel}>
              {getFilename(media.desktopSrc)}
            </small>
          ) : null}
        </div>
      )}
    </figure>
  );
}

function WorkshopSchematic({
  variant,
}: {
  variant: CarsystemMediaDefinition["variant"];
}) {
  return (
    <svg
      className={styles.workshopSchematic}
      viewBox="0 0 960 640"
      aria-hidden="true"
      focusable="false"
      data-variant={variant}
    >
      <defs>
        <linearGradient id={`floor-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".12" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".02" />
        </linearGradient>
        <pattern
          id={`grid-${variant}`}
          width="52"
          height="52"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M52 0H0V52"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".1"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="960" height="640" fill={`url(#grid-${variant})`} />
      <path
        d="M0 462 280 350 960 424V640H0Z"
        fill={`url(#floor-${variant})`}
      />
      <path
        className={styles.schematicWall}
        d="M92 120H868V442H92Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".22"
        strokeWidth="2"
      />
      <path
        className={styles.schematicLights}
        d="M160 172H356M603 172H800M235 218H724"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity=".42"
        strokeWidth="10"
      />
      <path
        className={styles.schematicCar}
        d="M249 418c17-66 72-109 145-109h159c67 0 119 43 139 109l47 13c21 6 35 25 35 47v34H191v-34c0-22 15-42 36-47l22-5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path
        className={styles.schematicCar}
        d="M330 313 379 251h184l68 62M313 418h385M260 512h446"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle
        className={styles.schematicWheel}
        cx="315"
        cy="493"
        r="48"
        fill="currentColor"
        fillOpacity=".08"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle
        className={styles.schematicWheel}
        cx="648"
        cy="493"
        r="48"
        fill="currentColor"
        fillOpacity=".08"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className={styles.schematicTool}
        d="M145 300h66v152h-66zM749 281h67v171h-67z"
        fill="currentColor"
        fillOpacity=".07"
        stroke="currentColor"
        strokeOpacity=".38"
        strokeWidth="2"
      />
      <path
        className={styles.schematicProcess}
        d={
          variant === "finish"
            ? "M112 552H335c55 0 55-54 110-54h184c55 0 55-54 110-54h103"
            : variant === "apply"
              ? "M112 552H284c53 0 53-70 106-70h239c52 0 52-70 104-70h109"
              : variant === "damage"
                ? "M112 552H416l48-72 42 72h336"
                : "M112 552H258c48 0 48-42 96-42h229c48 0 48-42 96-42h163"
        }
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <circle
        className={styles.schematicNode}
        cx="112"
        cy="552"
        r="9"
        fill="currentColor"
      />
      <circle
        className={styles.schematicNode}
        cx="842"
        cy={variant === "apply" ? "412" : variant === "finish" ? "444" : "468"}
        r="9"
        fill="currentColor"
      />
    </svg>
  );
}
