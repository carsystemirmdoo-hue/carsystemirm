"use client";

/* eslint-disable @next/next/no-img-element -- Approved brand and category assets are static public SVG files. */
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { CustomerAccountMenu } from "./CustomerAccountMenu";
import { ArrowIcon, BrandMenuLink, SearchIcon, isMenuLinkActive } from "./HeaderParts";
import {
  BRAND_LINKS,
  type HeaderMenuKey,
  PRODUCT_CATEGORIES,
  type SupportMenuGroup,
} from "@/components/layout/navigation-data";
import styles from "./HeaderMobileMenu.module.css";

/*
 * MOBILNI meni headera (2026-10-22): raspored i stilovi se uređuju ovde, nezavisno
 * od desktop menija. Stanje (otvaranje, fokus, korak istorije, pretraga) i podaci
 * navigacije ostaju zajednički u Header.tsx i navigation-data.ts.
 */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type HeaderMobileMenuProps = {
  panelId: string;
  panelRef: RefObject<HTMLElement>;
  closeRef: RefObject<HTMLButtonElement>;
  sectionIds: Record<"proizvodi" | "brendovi" | "sistemi", string>;
  openSection: HeaderMenuKey | null;
  onToggleSection: (section: HeaderMenuKey) => void;
  onClose: () => void;
  onNavigate: () => void;
  onSearch: () => void;
  pathname: string;
  active: Record<"product" | "brand" | "system" | "store", boolean>;
  /** Grupe menija „Saveti i podrška“ (bez „Saveti i vodiči“ dok nema objavljenog članka). */
  supportGroups: SupportMenuGroup[];
};

export function HeaderMobileMenu({
  panelId,
  panelRef,
  closeRef,
  sectionIds,
  openSection,
  onToggleSection,
  onClose,
  onNavigate,
  onSearch,
  pathname,
  active,
  supportGroups,
}: HeaderMobileMenuProps) {
  return (
    <div className={styles.mobileLayer}>
      <button
        type="button"
        className={styles.mobileScrim}
        aria-label="Zatvorite meni"
        tabIndex={-1}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        id={panelId}
        className={styles.mobilePanel}
        role="dialog"
        aria-modal="true"
        aria-label="Glavni meni"
      >
        <div className={styles.mobilePanelHeader}>
          <Link
            href="/"
            replace
            className={styles.mobilePanelBrand}
            onClick={onNavigate}
          >
            <span className={styles.mobilePanelLogo}>
              <img
                src="/brands/carsystem.svg"
                alt=""
                width="595"
                height="595"
                decoding="async"
              />
            </span>
          </Link>
          <button
            ref={closeRef}
            type="button"
            className={styles.mobileClose}
            aria-label="Zatvorite meni"
            onClick={onClose}
          >
            <span />
            <span />
          </button>
        </div>

        <nav className={styles.mobileScrollArea} aria-label="Mobilna navigacija">
          <p className={styles.mobileKicker}>Navigacija</p>
          <ul className={styles.mobileSectionList}>
            <li>
              <MobileAccordion
                id={sectionIds.proizvodi}
                label="Proizvodi"
                active={active.product}
                open={openSection === "proizvodi"}
                onToggle={() => onToggleSection("proizvodi")}
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <MobileMenuLink
                    key={category.slug}
                    href={category.href}
                    label={category.label}
                    active={isMenuLinkActive(category.href, pathname)}
                    onNavigate={onNavigate}
                  />
                ))}
              </MobileAccordion>
            </li>
            <li>
              <MobileAccordion
                id={sectionIds.brendovi}
                label="Brendovi"
                active={active.brand}
                open={openSection === "brendovi"}
                onToggle={() => onToggleSection("brendovi")}
              >
                <MobileMenuLink
                  href="/brendovi"
                  label="Svi brendovi"
                  active={pathname === "/brendovi"}
                  onNavigate={onNavigate}
                />
                <li className={styles.mobileBrandItem}>
                  <ul className={styles.mobileBrandGrid} aria-label="Brendovi">
                    {BRAND_LINKS.map((link) => (
                      <li key={link.href}>
                        <BrandMenuLink
                          brand={link}
                          active={isMenuLinkActive(link.href, pathname)}
                          onNavigate={onNavigate}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              </MobileAccordion>
            </li>
            <li>
              <MobileAccordion
                id={sectionIds.sistemi}
                label="Saveti i podrška"
                active={active.system}
                open={openSection === "sistemi"}
                onToggle={() => onToggleSection("sistemi")}
              >
                {supportGroups.map((group) => (
                  <li key={group.key} className={styles.mobileSubgroup}>
                    <p className={styles.mobileSubgroupLabel}>{group.title}</p>
                    <ul>
                      {group.key === "materijali" ? (
                        <MobileMenuLink
                          href="/program"
                          label="Svi programi"
                          active={pathname === "/program"}
                          onNavigate={onNavigate}
                        />
                      ) : null}
                      {group.links.map((link) => (
                        <MobileMenuLink
                          key={`${group.key}-${link.href}`}
                          href={link.href}
                          label={link.title}
                          active={isMenuLinkActive(link.href, pathname)}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </ul>
                  </li>
                ))}
              </MobileAccordion>
            </li>
            <MobileMenuLink
              href="/prodavnice"
              label="Prodavnice"
              active={active.store}
              primary
              onNavigate={onNavigate}
            />
          </ul>
        </nav>

        <div className={styles.mobileActions}>
          <button
            type="button"
            className={styles.mobileSearch}
            aria-haspopup="dialog"
            onClick={onSearch}
          >
            <SearchIcon />
            Pretražite proizvode
          </button>
          <CustomerAccountMenu variant="mobile" onNavigate={onNavigate} />
          <Link
            href="/kontakt"
            replace
            className={styles.mobileContact}
            onClick={onNavigate}
          >
            Kontakt
            <ArrowIcon />
          </Link>
        </div>
      </section>
    </div>
  );
}

function MobileAccordion({
  id,
  label,
  active,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.mobileGroup} data-active={active || undefined}>
      <button
        type="button"
        className={styles.mobileGroupTrigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className={styles.mobileGroupIcon} aria-hidden="true">
          <span />
          <span />
        </span>
      </button>
      <div
        id={id}
        className={styles.mobileGroupBody}
        data-open={open || undefined}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <ul>{children}</ul>
      </div>
    </section>
  );
}

function MobileMenuLink({
  href,
  label,
  active,
  primary = false,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  primary?: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        replace
        className={cx(styles.mobileLink, primary && styles.mobilePrimaryLink)}
        aria-current={active ? "page" : undefined}
        data-active={active || undefined}
        onClick={onNavigate}
      >
        <span>{label}</span>
        <ArrowIcon />
      </Link>
    </li>
  );
}
