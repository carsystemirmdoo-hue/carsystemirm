import Image from "next/image";
import { CounterUp } from "@/components/ui/CounterUp";
import type { CosmosHeroCan } from "@/lib/cosmos-lac-brand-data";
import styles from "./CosmosBrandPage.module.css";

type Props = {
  variants: number;
  lines: number;
  productGroups: number;
  silhouettes: CosmosHeroCan[];
};

/**
 * The range moment (specification §10).
 *
 * Communicates abundance typographically, not as analytics — one enormous
 * number, no KPI cards, no dashboard. The only ornament is a row of real cans
 * held at low opacity behind the numeral, so the claim about range is made
 * with the range itself.
 *
 * Every figure here is computed from the dataset and excludes third-party
 * branded records, so the public number is true for Cosmos Lac alone.
 */
export function CosmosRange({
  variants,
  lines,
  productGroups,
  silhouettes,
}: Props) {
  return (
    <section aria-labelledby="cosmos-range-title" className={styles.range}>
      <div className={styles.rangeSilhouettes} aria-hidden="true">
        {silhouettes.map((can) => (
          <Image
            alt=""
            height={800}
            key={can.slug}
            loading="lazy"
            sizes="110px"
            src={can.image}
            width={800}
          />
        ))}
      </div>

      <p className={styles.rangeNumber}>
        <CounterUp durationMs={900} value={variants} />
      </p>
      <h2 className={styles.rangeWord} id="cosmos-range-title">
        Varijanti
      </h2>
      <p className={`${styles.eyebrow} ${styles.rangeMeta}`}>
        {lines} linija · {productGroups} grupa proizvoda · jedna partnerska mreža
      </p>
    </section>
  );
}
