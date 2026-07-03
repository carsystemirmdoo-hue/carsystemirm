import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "cs-magnetic-cta cs-theme-wipe-card bg-accent text-accent-foreground",
  secondary:
    "cs-interactive-surface border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "cs-interactive-surface text-foreground hover:bg-surface-muted",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out";

export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      className={cn(baseClasses, VARIANT_CLASSES[variant], className)}
      data-cursor="button"
      data-motion-surface
      data-motion={variant === "primary" ? "theme-wipe" : undefined}
      {...rest}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}
