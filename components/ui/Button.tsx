import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

/*
 * Dugme sistema A: visina M 44 px, ugao 2 px, Plex Sans 600 15 px, bez
 * podizanja, senke i „wipe” sloja na prelaz mišem. Primarno = ispuna akcenta,
 * sekundarno = okvir boje teksta, providno.
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "border !border-[var(--ds-c-accent)] bg-[var(--ds-c-accent)] !text-[var(--ds-c-on-accent)] hover:!border-[var(--ds-c-accent-hover)] hover:bg-[var(--ds-c-accent-hover)] active:!border-[var(--ds-c-accent-press)] active:bg-[var(--ds-c-accent-press)]",
  secondary:
    "border !border-[var(--ds-c-text)] bg-transparent text-[var(--ds-c-text)] hover:bg-[var(--ds-c-surface-2)]",
  ghost: "border !border-transparent text-[var(--ds-c-text)] hover:bg-[var(--ds-c-surface-2)]",
};

const baseClasses =
  "inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center gap-2 rounded-[var(--ds-ctl-radius)] px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] no-underline transition-[background-color,color,border-color] duration-200 ease-out";

export function Button({
  href,
  variant = "primary",
  className,
  children,
  prefetch,
  ...rest
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  /** Prosleđuje se `next/link`; `false` za veze ka teškim stranama (npr. /katalog). */
  prefetch?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(baseClasses, VARIANT_CLASSES[variant], className)}
      data-cursor="button"
      {...rest}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}
