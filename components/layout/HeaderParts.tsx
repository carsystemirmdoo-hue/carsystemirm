import Image from "next/image";
import Link from "next/link";
import type { NavigationLink } from "@/components/layout/navigation-data";
import styles from "./Header.styles";
import { isPathActive } from "./headerPaths";

/*
 * Delovi headera koje dele desktop meni (Header.tsx) i mobilni meni
 * (HeaderMobileMenu.tsx). `data-hdr` atributi su sidra za stilove mobilnog
 * menija, čije klase pripadaju drugom CSS modulu (2026-10-22).
 */

export function BrandMenuLink({
  brand,
  active,
  onNavigate,
}: {
  brand: NavigationLink;
  active: boolean;
  onNavigate: () => void;
}) {
  const gallery = brand.menuGallery;
  const height = gallery?.height ?? brand.menuLogoHeight ?? 40;
  const monoHeight = gallery?.monoHeight ?? height;
  return (
    <Link
      href={brand.href}
      className={styles.brandLink}
      data-hdr="brand-link"
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      onClick={onNavigate}
    >
      <span className={styles.brandLinkArrow} data-hdr="brand-link-arrow" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" />
        </svg>
      </span>
      <span className={styles.brandLogoFrame} data-hdr="brand-logo-frame" aria-hidden="true">
        {brand.logo ? (
          <>
            <Image
              src={brand.logo}
              alt=""
              width={200}
              height={height}
              className={styles.brandLogo}
              data-logo-tone="color"
              style={{ height, width: "auto" }}
            />
            <Image
              src={gallery?.monoSrc ?? brand.logo}
              alt=""
              width={200}
              height={monoHeight}
              className={styles.brandLogo}
              data-logo-tone="mono"
              style={{ height: monoHeight, width: "auto" }}
            />
          </>
        ) : (
          <strong>{brand.title}</strong>
        )}
      </span>
      <span className={styles.brandLinkName} data-hdr="brand-link-name">{brand.title}</span>
    </Link>
  );
}

export function ArrowIcon() {
  return (
    <svg
      className={styles.arrowIcon}
      data-hdr="arrow-icon"
      aria-hidden="true"
      viewBox="0 0 18 18"
      fill="none"
    >
      <path d="M3.5 9h10M10 5.5 13.5 9 10 12.5" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      className={styles.searchIcon}
      data-hdr="search-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="10.8" cy="10.8" r="5.8" />
      <path d="m15.2 15.2 4.3 4.3" />
    </svg>
  );
}

/** Aktivna stavka menija: link sa upitom ili sidrom nikad nije „trenutna strana“. */
export function isMenuLinkActive(href: string, pathname: string) {
  if (href.includes("?") || href.includes("#")) return false;
  return isPathActive(href, pathname);
}
