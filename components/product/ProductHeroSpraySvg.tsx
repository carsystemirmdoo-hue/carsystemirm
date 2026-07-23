"use client";

import { useId } from "react";
import styles from "./ProductHeroSprayBackdrop.module.css";

export type ProductHeroSprayPhase =
  | "idle"
  | "running"
  | "complete"
  | "static";

const sprayAssetHref = "/product-hero-patterns/spray-six-pass.svg";

const revealPasses = [
  {
    pass: "01",
    path:
      "M 1200 -160 C 980 -35 790 60 625 165 C 500 245 340 350 80 460",
  },
  {
    pass: "02",
    path:
      "M 80 225 C 430 175 755 175 970 220 C 1140 255 1270 350 1450 490",
  },
  {
    pass: "03",
    path:
      "M 1450 285 C 1110 325 800 380 560 470 C 400 530 245 620 80 675",
  },
  {
    pass: "04",
    path:
      "M 60 455 C 405 450 715 450 940 500 C 1130 545 1280 660 1450 790",
  },
  {
    pass: "05",
    path:
      "M 1450 460 C 1120 500 835 560 620 665 C 430 755 260 860 80 925",
  },
  {
    pass: "06",
    path:
      "M 60 700 C 400 710 690 750 930 810 C 1110 855 1280 945 1450 1040",
  },
] as const;

function getStableIdPrefix(id: string) {
  return `product-hero-${id.replaceAll(":", "")}`;
}

export function ProductHeroSpraySvg({
  phase,
}: {
  phase: ProductHeroSprayPhase;
}) {
  const idPrefix = getStableIdPrefix(useId());
  const revealPathClasses = [
    styles.revealPath01,
    styles.revealPath02,
    styles.revealPath03,
    styles.revealPath04,
    styles.revealPath05,
    styles.revealPath06,
  ];

  return (
    <svg
      className={styles.spraySvg}
      viewBox="0 0 1536 1024"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-motion={phase === "static" ? "disabled" : "enabled"}
      data-phase={phase}
      data-spray-candidate="A"
      data-spray-asset={sprayAssetHref}
    >
      <defs>
        {revealPasses.map(({ pass, path }, index) => (
          <mask
            key={pass}
            id={`${idPrefix}-spray-mask-${pass}`}
            data-spray-mask={`spray-mask-${pass}`}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1536"
            height="1024"
            style={{ maskType: "alpha" }}
          >
            <path
              id={`${idPrefix}-reveal-path-${pass}`}
              data-reveal-path={`reveal-path-${pass}`}
              className={`${styles.revealPath} ${revealPathClasses[index]}`}
              d={path}
              fill="none"
              stroke="white"
              strokeWidth={500}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
          </mask>
        ))}
      </defs>

      <g data-spray-artwork="six-pass-candidate-a" fill="currentColor">
        {revealPasses.map(({ pass }) => (
          <g
            key={pass}
            id={`${idPrefix}-spray-pass-${pass}`}
            data-spray-pass={`spray-pass-${pass}`}
            mask={`url(#${idPrefix}-spray-mask-${pass})`}
          >
            <use href={`${sprayAssetHref}#spray-pass-${pass}`} />
          </g>
        ))}
      </g>
    </svg>
  );
}
