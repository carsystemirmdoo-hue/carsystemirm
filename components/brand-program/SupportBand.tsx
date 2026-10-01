import Link from "next/link";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import styles from "./BrandProgramPage.module.css";

export function SupportBand({
  body,
  extraHref,
  extraLabel,
  primaryHref,
  primaryLabel,
  title,
}: {
  body: string;
  extraHref?: string;
  extraLabel?: string;
  primaryHref: string;
  primaryLabel: string;
  title: string;
}) {
  return (
    <section className={styles.supportBand} aria-labelledby="entity-support-title">
      <div className={styles.supportCopy}>
        <p className={styles.sectionKicker}>Podrška</p>
        <h2 id="entity-support-title">{title}</h2>
        <p>{body}</p>
      </div>
      <div className={styles.supportActions}>
        <SplitContactCta inquiryHref={primaryHref} inquiryLabel={primaryLabel} />
        {extraHref && extraLabel ? (
          <Link
            className={`${styles.secondaryButton} cs-interactive-surface`}
            href={extraHref}
            data-cursor="button"
            data-motion-surface
          >
            {extraLabel}
          </Link>
        ) : null}
        <Link
          className={`${extraHref ? styles.ghostButton : styles.secondaryButton} cs-interactive-surface`}
          href="/prodavnice"
          data-cursor="button"
          data-motion-surface
        >
          Pronađite prodavnicu
        </Link>
      </div>
    </section>
  );
}
