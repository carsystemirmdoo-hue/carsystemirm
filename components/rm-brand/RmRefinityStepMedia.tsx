"use client";

import Image from "next/image";
import { useState } from "react";
import type { RmRefinityFlowStep } from "./rmBrandData";
import styles from "./RmBrandPage.module.css";

/**
 * Fotografija koraka Refinity toka. Ako se ne učita, pločica ostaje samo sa
 * brojem i nazivom (isti izgled kao pre fotografija), bez polomljene slike.
 */
export function RmRefinityStepMedia({
  image,
}: {
  image: RmRefinityFlowStep["image"];
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <div className={styles.refinityFlowMedia}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="(min-width: 50.0625rem) 18vw, 5rem"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
