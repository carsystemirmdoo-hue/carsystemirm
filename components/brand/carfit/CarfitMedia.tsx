import Image from "next/image";
import type { CarfitMediaSlot } from "@/lib/carfit-brand-data";
import styles from "./CarfitBrandPage.module.css";

/**
 * Media slot: fotografija ako postoji, inače tehnički modul.
 *
 * Fallback je namerno dizajniran element workshop mreže, a ne vidljiv
 * placeholder — layout ostaje stabilan i pre nego što fotografije stignu.
 */
export function CarfitMedia({
  className,
  mark,
  priority,
  sizes,
  slot,
}: {
  className?: string;
  mark: string;
  priority?: boolean;
  sizes: string;
  slot: CarfitMediaSlot;
}) {
  if (!slot.src) {
    return (
      <div className={`${styles.mediaFallback} ${className ?? ""}`} aria-hidden="true">
        <p className={styles.mediaFallbackCode}>{slot.id}</p>
        <p className={styles.mediaFallbackMark}>
          {mark}
          <span>.</span>
        </p>
      </div>
    );
  }

  return (
    <Image
      alt={slot.alt}
      className={className}
      height={slot.height}
      priority={priority}
      sizes={sizes}
      src={slot.src}
      width={slot.width}
    />
  );
}
