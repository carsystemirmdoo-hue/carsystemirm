"use client";

import { useEffect, useId, useRef, useState } from "react";

type Variant = "primary" | "secondary" | "danger";

/**
 * Dugme koje otvara dijalog za potvrdu (umesto `window.confirm`).
 *
 * Izvorni `<dialog>`: hvata fokus, Escape zatvara, fokus se vraća na dugme koje
 * ga je otvorilo. Ako radnja traži razlog, potvrda je onemogućena dok razlog nije
 * dovoljno dug, uz rečenicu zašto. Upisan a neposlat razlog obeležava obrazac kao
 * nesnimljen (`data-unsaved`), pa ga automatsko osvežavanje ne briše.
 */
export function ConfirmAction({
  label,
  variant = "secondary",
  title,
  body,
  confirmLabel,
  confirmVariant,
  pendingLabel = "Šalje se…",
  reason,
  disabled = false,
  pending = false,
  onConfirm,
}: {
  label: string;
  variant?: Variant;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: Variant;
  pendingLabel?: string;
  reason?: { label: string; help?: string; min: number; max?: number };
  disabled?: boolean;
  pending?: boolean;
  /** Vraća `true` kada je radnja uspela (dijalog se zatvara); greške prikazuje roditelj. */
  onConfirm: (reason: string) => Promise<unknown> | unknown;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();
  const short = reason ? text.trim().length < reason.min : false;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => trigger.current?.focus();
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  const open = () => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  };
  const close = () => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.close === "function") d.close();
    else {
      d.removeAttribute("open");
      trigger.current?.focus();
    }
  };

  const working = busy || pending;
  return (
    <>
      <button ref={trigger} type="button" className="pn-btn" data-variant={variant} disabled={disabled || working} onClick={open}>
        {label}
      </button>
      <dialog ref={dialog} className="pn-dialog" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <form
          method="dialog"
          data-unsaved={reason && text.trim() ? "true" : undefined}
          onSubmit={async (e) => {
            e.preventDefault();
            if (short || working) return;
            setBusy(true);
            try {
              await onConfirm(text.trim());
            } finally {
              setBusy(false);
              close();
            }
          }}
        >
          <h2 id={`${id}-t`}>{title}</h2>
          <div id={`${id}-d`} className="pn-muted" style={{ fontSize: 14 }}>
            {body}
          </div>
          {reason ? (
            <div className="pn-field">
              <label htmlFor={`${id}-r`}>
                {reason.label} <small>(najmanje {reason.min} znakova)</small>
              </label>
              <textarea id={`${id}-r`} value={text} onChange={(e) => setText(e.target.value)} maxLength={reason.max ?? 1000} rows={3} disabled={working} aria-describedby={reason.help ? `${id}-h` : undefined} />
              {reason.help ? (
                <span id={`${id}-h`} className="pn-help">
                  {reason.help}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="pn-actions pn-actions-inline">
            <button type="button" className="pn-btn" onClick={close} disabled={working}>
              Odustanite
            </button>
            <button type="submit" className="pn-btn" data-variant={confirmVariant ?? (variant === "danger" ? "danger" : "primary")} disabled={short || working} aria-busy={working || undefined}>
              {working ? pendingLabel : confirmLabel}
            </button>
          </div>
          {short ? <p className="pn-why" style={{ textAlign: "right" }}>Dugme se uključuje kada upišete razlog. Escape zatvara prozor.</p> : null}
        </form>
      </dialog>
    </>
  );
}
