import Image from "next/image";
import type { CarfitMediaSlot } from "@/lib/carfit-brand-data";
import styles from "./CarfitBrandPage.styles";

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
  products,
  sizes,
  slot,
}: {
  className?: string;
  mark: string;
  priority?: boolean;
  /** Stvarni C.A.R.FIT proizvodi iz kataloga kada scenska fotografija još ne postoji. */
  products?: { src: string; alt: string }[];
  sizes: string;
  slot: CarfitMediaSlot;
}) {
  if (!slot.src && products && products.length > 0) {
    return (
      <div
        className={`${styles.mediaProducts} ${className ?? ""}`}
        data-count={products.length}
      >
        {products.map((product) => (
          <span key={product.src}>
            <Image alt={product.alt} fill sizes={sizes} src={product.src} />
          </span>
        ))}
      </div>
    );
  }

  if (!slot.src) {
    return (
      <div className={`${styles.mediaFallback} ${className ?? ""}`} aria-hidden="true">
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
