import Image from "next/image";
import type { ProductImageAsset } from "@/lib/carsystem-data";
import {
  resolveQuantityLabel,
  resolveSizeClass,
  type ProductSize,
} from "@/lib/product-scale";
import styles from "./ProductStage.module.css";

/**
 * Product stage primitive (Phase 1 foundation).
 *
 * Lanac: (već normalizovan asset) → sizeClass envelope → centering →
 * rezervisana quantity-badge zona.
 *
 * Namerno CSS-only, bez runtime canvas analize slike:
 * - deterministično na serveru i klijentu (isti markup, isti CSS, nema
 *   hidration mismatch-a),
 * - ne zavisi od broja proizvoda učitanih na stranici,
 * - ne pravi layout shift — `stage` ima fiksan aspect-ratio i traka za
 *   quantity badge je REZERVISANA bez obzira da li se badge prikazuje.
 *
 * Auto-trim praznog prostora u samom asset-u (source whitespace) je odvojen
 * problem — rešava se pripremom/re-eksportom slika, ne runtime merenjem, i
 * ostaje van ove faze. Ova komponenta pretpostavlja razumno centrirane
 * izvorne slike (potvrđeno auditom) i razlikuje fizičku klasu pakovanja kroz
 * CSS `inset` po `data-size-class`, bez merenja piksela.
 *
 * Ova komponenta se u Phase 1 NE koristi ni na jednoj stranici — postoji kao
 * gotov, tipiziran, build-proveren primitiv za Phase 2 migraciju.
 */
export function ProductStage({
  image,
  size,
  alt,
  className,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, 45vw",
}: {
  image: ProductImageAsset | null;
  size?: ProductSize | null;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const sizeClass = resolveSizeClass(size);
  const quantityLabel = resolveQuantityLabel(size);

  return (
    <span
      className={[styles.stage, className].filter(Boolean).join(" ")}
      data-size-class={sizeClass}
    >
      <span className={styles.frame}>
        {image ? (
          <Image
            src={image.src}
            alt={alt ?? image.alt}
            fill
            sizes={sizes}
            priority={priority}
            className={styles.image}
          />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            <span className={styles.placeholderMark} />
          </span>
        )}
      </span>

      {quantityLabel ? (
        <span className={styles.badge} data-status={size?.volumeStatus}>
          <span className={styles.badgeRule} aria-hidden="true" />
          {quantityLabel}
        </span>
      ) : null}
    </span>
  );
}
