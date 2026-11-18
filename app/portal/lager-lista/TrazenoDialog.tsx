"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type { LagerCustomer, LagerRow } from "@/lib/stock/lager-list-service";
import { recordTrazenoAction } from "./actions";
import styles from "./LagerLista.module.css";

/**
 * „Traženo — nema na stanju“ (2026-11-16): komercijalista beleži da je kupac tražio artikal.
 * Količina je obavezna; kupac i napomena nisu. Zapis vidi vlasnik na Zalihama i na Nabavci.
 *
 * Nije modalni `<dialog>`: padajući meni kupaca se iscrtava u `body` i ispod gornjeg sloja
 * modalnog dijaloga bi bio nevidljiv. Zato običan sloj preko strane (Escape i klik van zatvaraju).
 */
export function TrazenoDialog({
  row,
  customers,
  defaultCustomerId,
  onClose,
  onDone,
}: {
  row: LagerRow;
  customers: LagerCustomer[];
  defaultCustomerId: string | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const qtyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    qtyInput.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=listbox]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const options = useMemo(
    () => [
      { value: "", label: "Bez kupca" },
      ...customers.map((c) => ({ value: c.id, label: c.city ? `${c.name} — ${c.city}` : c.name, keywords: [c.pib] })),
    ],
    [customers],
  );
  const unit = row.unit ? (row.unit.toUpperCase() === "LIT" ? "L" : row.unit.toLowerCase()) : "";

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await recordTrazenoAction({ articleId: row.key, quantity, customerId: customerId || null, note });
      if (!r.ok) return setError(r.text);
      onDone(`${r.text} ${row.name}${quantity ? ` — ${quantity} ${unit}` : ""}.`);
    });

  return (
    <div className={styles.overlay} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="trazeno-naslov">
        <form
          className={styles.dlg}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 id="trazeno-naslov">Traženo — nema na stanju</h2>
          <p>
            <b>{row.name}</b> · {row.code}
            <br />
            Stanje sada: {row.stock === null ? "nepoznato" : `${row.stock.toLocaleString("sr-Latn-RS")} ${unit}`}
          </p>
          <label className={styles.dlgField}>
            <span>Količina{unit ? ` (${unit})` : ""} — obavezno</span>
            <input
              ref={qtyInput}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              maxLength={12}
              required
              autoComplete="off"
              aria-invalid={error !== null && !quantity ? true : undefined}
            />
          </label>
          {customers.length ? (
            <div className={styles.dlgField}>
              <span>Kupac koji je tražio — nije obavezno</span>
              <SearchableCombobox
                ariaLabel="Kupac koji je tražio artikal"
                value={customerId}
                options={options}
                onChange={setCustomerId}
                placeholder="Bez kupca"
                searchPlaceholder="Naziv, mesto ili PIB kupca"
                emptyMessage="Nijedan kupac ne odgovara pretrazi."
                sheetTitle="Kupac koji je tražio"
              />
            </div>
          ) : null}
          <label className={styles.dlgField}>
            <span>Napomena — nije obavezno</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoComplete="off" placeholder="npr. treba do petka" />
          </label>
          {error ? (
            <p role="alert" className={styles.dlgError}>
              {error}
            </p>
          ) : null}
          <div className={styles.dlgActions}>
            <button type="button" className="portal-button" onClick={onClose} disabled={pending}>
              Odustani
            </button>
            <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
              {pending ? "Beležim…" : "Zabeleži"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
