"use client";

import { useRef } from "react";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import { useSplitContactCtaDemo } from "./useSplitContactCtaDemo";
import styles from "./SplitContactCtaWideShowcase.module.css";

/*
 * Horizontal 16:9 (1920×1080) recording stage for Contra/portfolio/desktop
 * presentation. Intentional desktop composition: fixed editorial metadata in
 * the upper-left lane, the untouched production SplitContactCta as the hero in
 * the dominant right-of-center area, and a signature closing the lower-left.
 * Opened by real pointer :hover manually or by the shared deterministic demo
 * loop (?demo=1) driving the real data-pointer-active pathway.
 *
 * Showcase-safe contact labels: the production default call label embeds the
 * company phone number, so the visible labels are overridden here (production
 * data untouched) to keep phone/email out of the recorded clip.
 */
export function SplitContactCtaWideShowcase({ isDemoMode }: { isDemoMode: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  useSplitContactCtaDemo(frameRef, isDemoMode);

  return (
    <div className={styles.stage}>
      {isDemoMode ? (
        /* Recording only: no scrollbar in the captured frame. */
        <style>{`html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }`}</style>
      ) : null}

      <header className={styles.editorialFrame} aria-hidden="true">
        <p className={styles.eyebrow}>
          Custom interactions <span>/ 003</span>
        </p>
        <p className={styles.editorialTitle}>
          Split contact
          <br />
          CTA
        </p>
      </header>

      <div className={styles.ctaStage}>
        <div ref={frameRef} className={styles.ctaFrame}>
          <SplitContactCta
            className={styles.cta}
            callLabel="CALL US"
            inquiryLabel="SEND INQUIRY"
          />
        </div>
      </div>

      <footer className={styles.signature} aria-hidden="true">
        <p className={styles.signatureName}>Studio One</p>
        <p className={styles.signatureRole}>Creative development</p>
      </footer>
    </div>
  );
}
