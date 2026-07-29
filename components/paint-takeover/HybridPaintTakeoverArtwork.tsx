"use client";

import { forwardRef, memo } from "react";
import styles from "./HybridPaintTakeoverArtwork.module.css";

type HybridPaintTakeoverArtworkProps = {
  artwork: string;
  className?: string;
};

export const HybridPaintTakeoverArtwork = memo(
  forwardRef<HTMLDivElement, HybridPaintTakeoverArtworkProps>(
    function HybridPaintTakeoverArtwork({ artwork, className }, ref) {
      const classes = className
        ? `${styles.artwork} ${className}`
        : styles.artwork;

      return (
        <div
          ref={ref}
          className={classes}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: artwork }}
        />
      );
    },
  ),
);
