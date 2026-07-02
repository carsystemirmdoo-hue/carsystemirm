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
}: {
  callLabel?: string;
  className?: string;
  inquiryHref?: string;
  inquiryLabel?: string;
}) {
  return (
    <span
      className={cx(styles.root, "cs-magnetic-cta cs-theme-wipe-card", className)}
      data-cursor="button"
      data-motion-surface
      data-motion="theme-wipe"
    >
      <a className={styles.callAction} href={companyContact.phoneHref}>
        {callLabel}
      </a>
      <Link className={styles.inquiryAction} href={inquiryHref}>
        {inquiryLabel}
      </Link>
    </span>
  );
}
