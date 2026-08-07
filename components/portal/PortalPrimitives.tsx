"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { DemoDataState, Permission } from "@/types/portal";
import { can } from "@/permissions/portal-permissions";
import { usePortal } from "./PortalProvider";
import { PortalIcon, type PortalIconName } from "./PortalIcon";

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("sr-Latn-RS", {
    style: "currency",
    currency: "RSD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className="portal-badge" data-tone={tone}>
      {dot ? <span className="portal-badge-dot" /> : null}
      {children}
    </span>
  );
}

export function statusTone(value: string): Tone {
  const normalized = value.toLowerCase();
  if (
    [
      "isporučena",
      "isporučeno",
      "sinhronizovano",
      "aktivno",
      "aktivan",
      "odobreno",
      "plaćeno",
      "usklađeno",
      "mapiran",
      "kreirana",
    ].some((item) => normalized.includes(item))
  )
    return "success";
  if (
    [
      "greška",
      "problem",
      "blokiran",
      "odbijeno",
      "kasni",
      "kritično",
      "reklamacija",
      "nema",
    ].some((item) => normalized.includes(item))
  )
    return "danger";
  if (
    [
      "čeka",
      "upozorenje",
      "u padu",
      "nisko",
      "dorada",
      "nepotpuno",
      "neusaglašeno",
      "preko",
    ].some((item) => normalized.includes(item))
  )
    return "warning";
  if (
    ["nova", "nov", "transport", "spremna", "najava"].some((item) =>
      normalized.includes(item),
    )
  )
    return "info";
  return "neutral";
}

type PortalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: PortalIconName;
  loading?: boolean;
};

export function PortalButton({
  variant = "secondary",
  icon,
  loading,
  children,
  className = "",
  disabled,
  ...props
}: PortalButtonProps) {
  const buttonType = props.type ?? "button";
  const hasAction = Boolean(
    props.onClick || buttonType === "submit" || props.formAction,
  );
  return (
    <button
      type={buttonType}
      className={`portal-button ${className}`}
      data-variant={variant}
      disabled={disabled || loading || !hasAction}
      {...props}
    >
      {loading ? (
        <span className="portal-button-spinner" />
      ) : icon ? (
        <PortalIcon name={icon} />
      ) : null}
      <span>{loading ? "Obrada…" : children}</span>
    </button>
  );
}

export function PortalLinkButton({
  href,
  variant = "secondary",
  icon,
  children,
  className = "",
}: {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: PortalIconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`portal-button ${className}`}
      data-variant={variant}
    >
      {icon ? <PortalIcon name={icon} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="portal-page-header">
      <div>
        <div className="portal-page-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="portal-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="portal-page-actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="portal-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: Tone;
}) {
  return (
    <section className={`portal-panel ${className}`} data-accent={accent}>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  change,
  tone = "neutral",
  context,
  icon,
}: {
  label: string;
  value: string;
  change?: string;
  tone?: Tone;
  context?: string;
  icon?: PortalIconName;
}) {
  return (
    <div className="portal-metric" data-tone={tone}>
      <div className="portal-metric-top">
        <span>{label}</span>
        {icon ? <PortalIcon name={icon} /> : null}
      </div>
      <strong>{value}</strong>
      <div className="portal-metric-foot">
        {change ? (
          <span className="portal-metric-change" data-tone={tone}>
            {change}
          </span>
        ) : null}
        {context ? <span>{context}</span> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="portal-field">
      <span>
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      {children}
      {error ? (
        <small className="portal-field-error">{error}</small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </label>
  );
}

export function StateView({
  state,
  title,
  description,
  action,
}: {
  state: Exclude<DemoDataState, "normal"> | "permission";
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  if (state === "loading")
    return (
      <div className="portal-skeleton-stack" aria-label="Učitavanje">
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  const defaults = {
    empty: ["Nema rezultata", "Promenite filtere ili dodajte prvi zapis."],
    error: [
      "Nešto nije u redu",
      "Mock servis trenutno ne može da prikaže podatke. Pokušajte ponovo.",
    ],
    offline: [
      "Integracija nije dostupna",
      "Lokalni podaci ostaju vidljivi, sinhronizacija će čekati ponovno povezivanje.",
    ],
    permission: [
      "Nemate dozvolu za ovaj prikaz",
      "Dostupnost podataka i akcija zavisi od izabrane uloge.",
    ],
  } as const;
  const [fallbackTitle, fallbackDescription] = defaults[state];
  return (
    <div className="portal-state" data-state={state}>
      <span className="portal-state-icon">
        <PortalIcon
          name={
            state === "permission"
              ? "lock"
              : state === "offline"
                ? "sync"
                : state === "error"
                  ? "warning"
                  : "search"
          }
        />
      </span>
      <h2>{title || fallbackTitle}</h2>
      <p>{description || fallbackDescription}</p>
      {action}
    </div>
  );
}

export function ModuleState({
  children,
  allowEmpty = true,
}: {
  children: ReactNode;
  allowEmpty?: boolean;
}) {
  const { uiState, setUiState } = usePortal();
  if (uiState === "normal" || (!allowEmpty && uiState === "empty"))
    return <>{children}</>;
  return (
    <Panel>
      <StateView
        state={uiState}
        action={
          <PortalButton onClick={() => setUiState("normal")}>
            Vrati normalno stanje
          </PortalButton>
        }
      />
    </Panel>
  );
}

export function AccessGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { role } = usePortal();
  if (!can(role, permission)) return <StateView state="permission" />;
  return <>{children}</>;
}

export function TinyBars({
  values,
  tone = "accent",
}: {
  values: number[];
  tone?: Tone;
}) {
  const max = Math.max(...values);
  return (
    <div className="portal-tiny-bars" aria-label="Grafički prikaz trenda">
      {values.map((value, index) => (
        <span
          key={index}
          style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
          data-tone={tone}
        />
      ))}
    </div>
  );
}

export function Delta({
  value,
  suffix = "%",
}: {
  value: number;
  suffix?: string;
}) {
  return (
    <span
      className="portal-delta"
      data-direction={value < 0 ? "down" : value > 0 ? "up" : "flat"}
    >
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

export function SelectionCheckbox({
  checked,
  mixed = false,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={inputRef}
      className="portal-table-checkbox"
      type="checkbox"
      checked={checked}
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onChange={onChange}
    />
  );
}

export function BulkToolbar({
  selectedCount,
  itemLabel,
  scopeLabel,
  onClear,
  children,
}: {
  selectedCount: number;
  itemLabel: string;
  scopeLabel: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div className="portal-bulk-slot" aria-live="polite">
      {selectedCount ? (
        <div className="portal-bulk-bar">
          <div className="portal-bulk-summary">
            <strong>
              {selectedCount} {itemLabel}
            </strong>
            <span>{scopeLabel}</span>
          </div>
          <div className="portal-bulk-actions">
            {children}
            <PortalButton variant="ghost" icon="close" onClick={onClear}>
              Poništi izbor
            </PortalButton>
          </div>
        </div>
      ) : (
        <div className="portal-bulk-empty">
          <span>Izaberite redove za grupne akcije.</span>
          <small>{scopeLabel}</small>
        </div>
      )}
    </div>
  );
}

let activeDialogLocks = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";

export function useDialogDismiss(onClose: () => void, active = true) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialogs = document.querySelectorAll<HTMLElement>("[role='dialog']");
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const affectedSiblings = Array.from(
      dialog.parentElement?.children ?? [],
    ).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== dialog,
    );
    const siblingState = affectedSiblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    siblingState.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });

    if (activeDialogLocks === 0) {
      savedBodyOverflow = document.body.style.overflow;
      savedBodyPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0)
        document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    activeDialogLocks += 1;

    if (
      !dialog.hasAttribute("aria-label") &&
      !dialog.hasAttribute("aria-labelledby")
    ) {
      dialog.setAttribute(
        "aria-label",
        dialog.querySelector("h1, h2, h3")?.textContent?.trim() || "Dijalog",
      );
    }
    const closeButton = dialog.querySelector<HTMLElement>(
      "header > .portal-icon-button",
    );
    if (closeButton && !closeButton.hasAttribute("aria-label"))
      closeButton.setAttribute("aria-label", "Zatvori dijalog");

    const focusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          element.getAttribute("aria-hidden") !== "true",
      );
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = focusableElements()[0];
      if (firstFocusable) firstFocusable.focus();
      else {
        dialog.tabIndex = -1;
        dialog.focus();
      }
    });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKey);
      siblingState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      activeDialogLocks = Math.max(0, activeDialogLocks - 1);
      if (activeDialogLocks === 0) {
        document.body.style.overflow = savedBodyOverflow;
        document.body.style.paddingRight = savedBodyPaddingRight;
      }
      previousFocus?.focus();
    };
  }, [active]);
}
