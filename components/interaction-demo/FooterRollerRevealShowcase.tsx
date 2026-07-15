"use client";

import { Footer } from "@/components/layout/Footer";
import { useFooterRevealDemoScroll } from "./useFooterRevealDemoScroll";
import styles from "./FooterRollerRevealShowcase.module.css";

/*
 * Vertical 9:16 recording stage. The fixed editorial frame and the signature
 * band are static typography only — they never touch the footer geometry;
 * the footer is the untouched production Footer/FooterReveal driven by real
 * page scroll (manual, or the shared deterministic demo loop for ?demo=1).
 */
export function FooterRollerRevealShowcase({ isDemoMode }: { isDemoMode: boolean }) {
  useFooterRevealDemoScroll(isDemoMode);

  return (
    <div className={styles.stage}>
      {/* Route-scoped vertical-frame scale: raises rem so the untouched
          production footer reads clearly in a 1080×1920 frame. Rendered
          server-side so there is no first-paint size flash. */}
      <style>{`html { font-size: 20px; }`}</style>
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
        <div className={styles.preludeBlock} data-variant="tall" />
        <div className={styles.preludeBlock} />
        <p className={styles.preludeCaption}>
          <span>kraj stranice</span>
          <span className={styles.preludeCaptionRule} />
        </p>
      </section>

      <Footer />

      <footer className={styles.signature} aria-hidden="true">
        <p className={styles.signatureName}>Studio One</p>
        <p className={styles.signatureRole}>Creative development</p>
      </footer>
    </div>
  );
}
