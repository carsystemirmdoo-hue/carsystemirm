"use client";

import { Footer } from "@/components/layout/Footer";
import { useFooterRevealDemoScroll } from "./useFooterRevealDemoScroll";
import styles from "./FooterRollerRevealWideShowcase.module.css";

/*
 * Horizontal 16:9 (1920×1080) recording stage for Contra/portfolio/desktop
 * presentation. Intentional desktop composition: a clear typographic lane
 * on the left with the fixed editorial frame, approach content on the
 * right, and the untouched production Footer/FooterReveal as the hero,
 * driven by real page scroll (manual, or the shared deterministic demo
 * loop for ?demo=1). Rendered at the native desktop rem scale.
 */
export function FooterRollerRevealWideShowcase({ isDemoMode }: { isDemoMode: boolean }) {
  useFooterRevealDemoScroll(isDemoMode);

  return (
    <div className={styles.stage}>
      {isDemoMode ? (
        /* Recording only: no scrollbar in the captured frame. */
        <style>{`html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }`}</style>
      ) : null}

      <header className={styles.editorialFrame} aria-hidden="true">
        <p className={styles.eyebrow}>
          Custom interactions <span>/ 002</span>
        </p>
        <p className={styles.editorialTitle}>
          Scroll-driven
          <br />
          footer reveal
        </p>
      </header>

      <section className={styles.prelude} aria-hidden="true">
        <div className={styles.preludeRail}>
          <div className={styles.preludeBlock} data-variant="tall" />
          <div className={styles.preludeBlock} />
          <p className={styles.preludeCaption}>
            <span>kraj stranice</span>
            <span className={styles.preludeCaptionRule} />
          </p>
        </div>
      </section>

      <Footer />

      <footer className={styles.signature} aria-hidden="true">
        <p className={styles.signatureName}>Studio One</p>
        <p className={styles.signatureRole}>Creative development</p>
      </footer>
    </div>
  );
}
