import Image from "next/image";
import {
  PUTTY_MATERIAL_TRACE_ASPECT,
  PUTTY_MATERIAL_TRACE_ASSETS,
  PUTTY_MATERIAL_TRACE_WIDTH,
} from "@/lib/putty-material-trace";
import styles from "./PuttyMaterialTrace.module.css";

/**
 * Dva sloja traga kita, odozdo nagore: senka pa materijal.
 *
 * Komponenta je čisto dekorativna — `aria-hidden` na wrapperu i prazan `alt`
 * na oba sloja, bez pointer eventova. Ne dodaje nijedan interaktivni element i
 * ne dodiruje sloj proizvoda, koji ostaje iznad nje po `z-index` skali panela.
 */
export function PuttyMaterialTrace({ sizes }: { sizes: string }) {
  return (
    <span
      className={styles.trace}
      style={{
        "--putty-trace-width": PUTTY_MATERIAL_TRACE_WIDTH,
        "--putty-trace-aspect": PUTTY_MATERIAL_TRACE_ASPECT,
      } as React.CSSProperties}
      aria-hidden="true"
      data-putty-material-trace
    >
      <Image
        src={PUTTY_MATERIAL_TRACE_ASSETS.shadow}
        alt=""
        fill
        sizes={sizes}
        className={styles.layer}
        data-putty-trace-layer="shadow"
      />
      <Image
        src={PUTTY_MATERIAL_TRACE_ASSETS.material}
        alt=""
        fill
        sizes={sizes}
        className={styles.layer}
        data-putty-trace-layer="material"
      />
    </span>
  );
}
