import { Fragment } from "react";
import styles from "./CosmosBrandPage.module.css";

type Props = {
  items: string[];
};

/**
 * Transition band (specification §13).
 *
 * A hinge between scenes, not a content block. The run is duplicated exactly
 * once and translated -50%, which is the cheapest possible seamless loop: two
 * text runs, one CSS animation, no JavaScript and no per-item DOM overhead.
 * Marked decorative because every word it shows already exists on the page as
 * a real link.
 */
export function CosmosBand({ items }: Props) {
  /*
   * Word and separator are siblings sharing one flex gap, so the spacing across
   * the loop seam is identical to the spacing between any two words. Nesting
   * the separator inside the word made the seam visibly wider than the rhythm.
   */
  const run = (
    <div className={styles.bandRun}>
      {items.map((item) => (
        <Fragment key={item}>
          <span>{item}</span>
          <i className={styles.bandDot} />
        </Fragment>
      ))}
    </div>
  );

  return (
    <div aria-hidden="true" className={styles.band}>
      <div className={styles.bandTrack}>
        {run}
        {run}
      </div>
    </div>
  );
}
