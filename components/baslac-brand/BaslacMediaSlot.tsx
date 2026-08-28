"use client";

import { useState, type CSSProperties } from "react";
import type {
  BaslacMediaDefinition,
  BaslacMediaAvailability,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

type BaslacMediaSlotProps = {
  availability: BaslacMediaAvailability[BaslacMediaDefinition["id"]];
  className?: string;
  media: BaslacMediaDefinition;
  priority?: boolean;
};

export function BaslacMediaSlot({
  availability,
  className,
  media,
  priority = false,
}: BaslacMediaSlotProps) {
  const [failed, setFailed] = useState(false);
  const hasDesktopAsset = availability.desktop && !failed;
  const hasMobileAsset = Boolean(
    media.mobileSrc && availability.mobile && !failed,
  );
  const mobileWidth = media.mobileWidth ?? media.width;
  const mobileHeight = media.mobileHeight ?? media.height;

  return (
    <figure
      className={`${styles.mediaSlot}${className ? ` ${className}` : ""}`}
      data-has-asset={hasDesktopAsset || undefined}
      style={
        {
          "--baslac-media-ratio": `${media.width} / ${media.height}`,
          "--baslac-media-mobile-ratio": `${mobileWidth} / ${mobileHeight}`,
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
            onError={() => setFailed(true)}
          />
        </picture>
      ) : (
        <div
          className={styles.mediaPlaceholder}
          role="img"
          aria-label={`Fotografija za ${media.section} još nije dostupna`}
        >
          <span className={styles.mediaPlaceholderMark}>Baslac</span>
          <strong>Fotografija u pripremi</strong>
        </div>
      )}
      <figcaption>{media.section}</figcaption>
    </figure>
  );
}
