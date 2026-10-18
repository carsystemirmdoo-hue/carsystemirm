import Link from "next/link";
import { companyContact } from "@/lib/company-contact";
import styles from "./SplitContactCta.module.css";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SplitContactCta({
  callLabel = companyContact.phone ? `Pozovite ${companyContact.phone}` : undefined,
  className,
  inquiryHref = "/kontakt",
  inquiryLabel = "Pošaljite upit",
  variant = "vertical",
}: {
  callLabel?: string;
  className?: string;
  inquiryHref?: string;
  inquiryLabel?: string;
  variant?: "vertical";
}) {
  // Bez potvrđenog broja nema poziva: ostaje samo upit, bez praznog `tel:` linka.
  const phoneHref = companyContact.phoneHref;
  const showCall = Boolean(phoneHref && callLabel);

  return (
    <span
      className={cx(styles.root, className)}
      data-variant={variant}
      data-call={showCall ? undefined : "none"}
      data-cursor="button"
      data-motion-surface
    >
      {showCall ? (
        <span className={styles.callSlot}>
          <a className={`${styles.callAction} cs-cta`} data-cta-on="theme" href={phoneHref ?? undefined}>
            {callLabel}
          </a>
        </span>
      ) : null}
      <Link className={`${styles.inquiryAction} cs-cta`} data-cta-on="theme" href={inquiryHref}>
        {inquiryLabel}
      </Link>
    </span>
  );
}
