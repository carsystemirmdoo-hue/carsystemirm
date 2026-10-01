"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./SearchableCombobox.module.css";

export type ComboboxOption = {
  disabled?: boolean;
  keywords?: string[];
  label: string;
  value: string;
};

type PanelPosition = {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
};

type SearchableComboboxProps = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  emptyMessage: string;
  id?: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  sheetTitle?: string;
  value: string;
};

const MOBILE_QUERY = "(max-width: 720px)";

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("sr-Latn")
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function SearchableCombobox({
  ariaLabel,
  className,
  disabled = false,
  emptyMessage,
  id,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  sheetTitle = ariaLabel,
  value,
}: SearchableComboboxProps) {
  const generatedId = useId().replaceAll(":", "");
  const triggerId = id ?? `combobox-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const statusId = `${triggerId}-status`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({
    left: 12,
    maxHeight: 400,
    top: 12,
    width: 280,
  });

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return options;

    return options.filter((option) =>
      normalizeSearchValue([option.label, ...(option.keywords ?? [])].join(" ")).includes(
        normalizedQuery,
      ),
    );
  }, [options, query]);

  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption
    ? `${listboxId}-option-${options.findIndex((option) => option.value === activeOption.value)}`
    : undefined;

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || window.matchMedia(MOBILE_QUERY).matches) return;

    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 12;
    const gap = 8;
    const availableBelow = window.innerHeight - rect.bottom - gap - viewportMargin;
    const availableAbove = rect.top - gap - viewportMargin;
    const placeAbove = availableBelow < 320 && availableAbove > availableBelow;
    const availableHeight = placeAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(180, Math.min(400, availableHeight));
    const width = Math.min(rect.width, window.innerWidth - viewportMargin * 2);
    const left = Math.min(
      Math.max(rect.left, viewportMargin),
      window.innerWidth - width - viewportMargin,
    );

    setPanelPosition(
      placeAbove
        ? {
            bottom: window.innerHeight - rect.top + gap,
            left,
            maxHeight,
            width,
          }
        : {
            left,
            maxHeight,
            top: rect.bottom + gap,
            width,
          },
    );
  }, []);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  const openMenu = useCallback(
    (preferredIndex?: number) => {
      if (disabled || options.length === 0) return;
      const selectedIndex = options.findIndex((option) => option.value === value);
      setQuery("");
      setActiveIndex(preferredIndex ?? Math.max(0, selectedIndex));
      setOpen(true);
    },
    [disabled, options, value],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    updatePanelPosition();
    const focusFrame = window.requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });

    function handleViewportChange(event?: Event) {
      const scrollContainer = triggerRef.current?.closest(
        "[data-combobox-scroll-container]",
      );

      if (
        event?.type === "scroll" &&
        !isMobile &&
        scrollContainer &&
        !(
          event.target instanceof Node &&
          panelRef.current?.contains(event.target)
        )
      ) {
        closeMenu(false);
        return;
      }

      updatePanelPosition();
    }

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeMenu(false);
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("pointerdown", handleOutsidePointer);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [closeMenu, isMobile, open, updatePanelPosition]);

  useEffect(() => {
    if (!open || !isMobile) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isMobile, open]);

  useEffect(() => {
    if (!open) return;
    if (filteredOptions.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => Math.min(current, filteredOptions.length - 1));
  }, [filteredOptions, open]);

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, open]);

  function selectOption(option: ComboboxOption) {
    if (option.disabled) return;
    onChange(option.value);
    closeMenu(true);
  }

  function moveActive(delta: 1 | -1) {
    if (filteredOptions.length === 0) return;

    setActiveIndex((current) => {
      let next = current;
      for (let offset = 0; offset < filteredOptions.length; offset += 1) {
        next = (next + delta + filteredOptions.length) % filteredOptions.length;
        if (!filteredOptions[next]?.disabled) return next;
      }
      return current;
    });
  }

  function moveFocusAfterTrigger(backward: boolean) {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        isVisible(element) &&
        !panelRef.current?.contains(element) &&
        element.getAttribute("aria-hidden") !== "true",
    );
    const currentIndex = focusable.indexOf(trigger);
    const nextIndex = currentIndex + (backward ? -1 : 1);
    const nextElement = focusable[nextIndex];
    closeMenu(false);
    window.requestAnimationFrame(() => nextElement?.focus({ preventScroll: false }));
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const selectedIndex = options.findIndex((option) => option.value === value);
      const fallbackIndex = event.key === "ArrowDown" ? 0 : Math.max(0, options.length - 1);
      openMenu(selectedIndex >= 0 ? selectedIndex : fallbackIndex);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) closeMenu(false);
      else openMenu();
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      moveFocusAfterTrigger(event.shiftKey);
    }
  }

  const panelStyle = {
    bottom: panelPosition.bottom,
    left: panelPosition.left,
    maxHeight: panelPosition.maxHeight,
    top: panelPosition.top,
    width: panelPosition.width,
  } satisfies CSSProperties;

  return (
    <div className={`${styles.root} ${className ?? ""}`} data-open={open || undefined}>
      <button
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-controls={listboxId}
        aria-describedby={open ? statusId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={styles.trigger}
        disabled={disabled}
        id={triggerId}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className={selectedOption ? styles.triggerValue : styles.triggerPlaceholder}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg aria-hidden="true" className={styles.chevron} viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <div className={`${styles.layer} ${isMobile ? styles.layerMobile : ""}`}>
              {isMobile ? (
                <div
                  aria-hidden="true"
                  className={styles.backdrop}
                  onPointerDown={() => closeMenu(true)}
                />
              ) : null}
              <div
                aria-label={sheetTitle}
                aria-modal={isMobile || undefined}
                className={styles.panel}
                ref={panelRef}
                role={isMobile ? "dialog" : undefined}
                style={panelStyle}
              >
                <div className={styles.sheetHeader}>
                  <strong>{sheetTitle}</strong>
                  <button
                    aria-label="Zatvorite izbor"
                    className={styles.closeButton}
                    onClick={() => closeMenu(true)}
                    type="button"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
                <div className={styles.searchWrap}>
                  <svg aria-hidden="true" className={styles.searchIcon} viewBox="0 0 20 20">
                    <circle cx="8.75" cy="8.75" r="5.75" />
                    <path d="m13 13 4 4" />
                  </svg>
                  <input
                    aria-activedescendant={activeOptionId}
                    aria-controls={listboxId}
                    aria-describedby={statusId}
                    aria-label={searchPlaceholder}
                    autoComplete="off"
                    className={styles.searchInput}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={searchPlaceholder}
                    ref={searchRef}
                    role="searchbox"
                    type="search"
                    value={query}
                  />
                  <span aria-live="polite" className={styles.srOnly} id={statusId}>
                    {filteredOptions.length === 1
                      ? "1 rezultat"
                      : `${filteredOptions.length} rezultata`}
                  </span>
                </div>

                <div aria-label={ariaLabel} className={styles.list} id={listboxId} role="listbox">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => {
                      const originalIndex = options.findIndex(
                        (candidate) => candidate.value === option.value,
                      );
                      const isSelected = option.value === value;
                      return (
                        <button
                          aria-selected={isSelected}
                          className={styles.option}
                          data-active={index === activeIndex || undefined}
                          disabled={option.disabled}
                          id={`${listboxId}-option-${originalIndex}`}
                          key={option.value}
                          onClick={() => selectOption(option)}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseMove={() => setActiveIndex(index)}
                          role="option"
                          tabIndex={-1}
                          type="button"
                        >
                          <span>{option.label}</span>
                          <span aria-hidden="true" className={styles.check}>
                            {isSelected ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className={styles.emptyState}>{emptyMessage}</p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
