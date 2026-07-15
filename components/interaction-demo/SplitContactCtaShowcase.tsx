"use client";

import { useRef } from "react";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import { useSplitContactCtaDemo } from "./useSplitContactCtaDemo";
import styles from "./SplitContactCtaShowcase.module.css";

/*
 * Vertical 9:16 recording stage for the split contact CTA showcase. The fixed
 * editorial frame and signature band are static typography only; the hero is
 * the untouched production SplitContactCta, opened by real pointer :hover
 * manually or by the shared deterministic demo loop (?demo=1) driving the real
 * data-pointer-active pathway.
 *
 * Showcase-safe contact labels: the production default call label embeds the
 * company phone number, so the visible labels are overridden here (production
 * data untouched) to keep phone/email out of the recorded clip.
 */
export function SplitContactCtaShowcase({ isDemoMode }: { isDemoMode: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  useSplitContactCtaDemo(frameRef, isDemoMode);

  return (
    <div className={styles.stage}>
      {/* Route-scoped vertical-frame scale, rendered server-side so there is no
          first-paint size flash. */}
      <style>{`html { font-size: 20px; }`}</style>
      {isDemoMode ? (
        /* Recording only: no scrollbar in the captured frame. */
        <style>{`html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }`}</style>
      ) : null}

      <header className={styles.editorialFrame} aria-hidden="true">
        <p className={styles.eyebrow}>
          Custom interactions <span>/ 003</span>
        </p>
        <p className={styles.editorialTitle}>Split contact CTA</p>
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
