"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import styles from "./PortalSelect.module.css";

export type PortalSelectOption = { value: string; label: string };

/**
 * Padajući meni portala (2026-11-10) — isti izgled kao padajući meniji na sajtu
 * (dugme sa strelicom odmaknutom od ivice, lista sa označenim izborom), ali
 * na bojama portala, bez `oklch` (kancelarijski Chrome 109).
 *
 * Radi u običnom GET obrascu: vrednost ide kroz skriveno polje `name`, pa
 * serverske strane i filteri ostaju bez JavaScript stanja. Tastatura:
 * strelice, Home/End, Enter/razmak, Escape, Tab zatvara.
 */
export function PortalSelect({
  name,
  defaultValue,
  options,
  ariaLabel,
  onChange,
}: {
  name: string;
  defaultValue: string;
  options: PortalSelectOption[];
  ariaLabel?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    setValue(o.value);
    setOpen(false);
    onChange?.(o.value);
    button.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    }
  };

  return (
    <div ref={root} className={styles.root} data-open={open ? "true" : undefined}>
      <input type="hidden" name={name} value={value} />
      <button
        ref={button}
        type="button"
        role="combobox"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        <span className={styles.value}>{selected?.label ?? ""}</span>
        <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <ul ref={list} id={`${id}-list`} role="listbox" className={styles.panel} aria-label={ariaLabel}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              data-index={i}
              data-value={o.value}
              aria-selected={o.value === value}
              data-active={i === active ? "true" : undefined}
              className={styles.option}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {o.value === value ? (
                <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
