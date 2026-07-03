import Link from "next/link";
import { companyContact } from "@/lib/company-contact";
import styles from "./SplitContactCta.module.css";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SplitContactCta({
  callLabel = `Pozovi ${companyContact.phone}`,
  className,
  inquiryHref = "/kontakt",
  inquiryLabel = "Pošalji upit",
  variant = "vertical",
}: {
  callLabel?: string;
  className?: string;
  inquiryHref?: string;
  inquiryLabel?: string;
  variant?: "vertical";
}) {
  return (
    <span
      className={cx(styles.root, "cs-magnetic-cta cs-theme-wipe-card", className)}
      data-variant={variant}
      data-cursor="button"
      data-motion-surface
      data-motion="theme-wipe"
    >
      <span className={styles.callSlot}>
        <a className={styles.callAction} href={companyContact.phoneHref}>
          {callLabel}
        </a>
      </span>
      <Link className={styles.inquiryAction} href={inquiryHref}>
        {inquiryLabel}
      </Link>
    </span>
  );
}
