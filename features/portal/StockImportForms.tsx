"use client";

import { useActionState, useId, useRef, useState } from "react";
import { confirmStockAction, discardStockAction, uploadStockAction, type StockImportActionState } from "@/app/portal/zalihe/uvoz/actions";

const INITIAL: StockImportActionState = { error: null, ok: null };
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = ".pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

function Status({ state }: { state: StockImportActionState }) {
  if (state.error) return <p className="portal-login-error lg-status" role="alert">{state.error}</p>;
  if (state.ok) return <p className="portal-permission-ok lg-status" role="status">{state.ok}</p>;
  return null;
}

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/**
 * Korak 1 — izbor fajla. Fajl se samo čita i upisuje za proveru; važeći snimak se ne menja.
 * Native polje za fajl ostaje u formi (tastatura, čitač ekrana), a vidljiv je srpski prikaz.
 */
export function StockUploadForm() {
  const [state, action, pending] = useActionState(uploadStockAction, INITIAL);
  const [file, setFile] = useState<{ name: string; bytes: number } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const tooBig = file !== null && file.bytes > MAX_BYTES;

  const take = (list: FileList | null) => {
    const f = list?.[0];
    setFile(f ? { name: f.name, bytes: f.size } : null);
  };

  return (
    <form action={action} className="lg-upload">
      <label
        htmlFor={id}
        className="lg-drop"
        data-over={over ? "true" : undefined}
        data-has-file={file ? "true" : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (input.current && e.dataTransfer.files.length) {
            input.current.files = e.dataTransfer.files;
            take(e.dataTransfer.files);
          }
        }}
      >
        <input
          ref={input}
          id={id}
          className="lg-file-input"
          type="file"
          name="lager"
          accept={ACCEPT}
          required
          disabled={pending}
          onChange={(e) => take(e.currentTarget.files)}
        />
        <span className="lg-drop-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M9 13h6M9 17h4" />
          </svg>
        </span>
        <span className="lg-drop-text">
          {file ? (
            <>
              <strong>{file.name}</strong>
              <small>{size(file.bytes)}</small>
            </>
          ) : (
            <>
              <strong>Izaberite izvoz lagera</strong>
              <small>PDF, XLSX ili CSV iz BizniSofta, do 4 MB — ili prevucite fajl ovde</small>
            </>
          )}
        </span>
        <span className="portal-button lg-drop-button" data-variant="secondary" aria-hidden="true">
          {file ? "Drugi fajl" : "Izaberite fajl"}
        </span>
      </label>
      {tooBig ? <p className="portal-login-error lg-status" role="alert">Fajl je veći od 4 MB.</p> : null}
      <div className="lg-actions">
        <button type="submit" className="portal-button" data-variant="primary" disabled={pending || !file || tooBig}>
          {pending ? "Proveravam fajl…" : "Proverite fajl"}
        </button>
        <span className="lg-hint">Ništa se ne menja dok ne potvrdite u sledećem koraku.</span>
      </div>
      <Status state={state} />
    </form>
  );
}

/** Korak 3 — potvrda. Traži izričitu potvrdu i svež drugi faktor. */
export function StockConfirmForm({ importId, lines, stockDate }: { importId: string; lines: number; stockDate: string }) {
  const [state, action, pending] = useActionState(confirmStockAction, INITIAL);
  return (
    <form action={action} className="lg-decision">
      <input type="hidden" name="importId" value={importId} />
      <label className="lg-check">
        <input type="checkbox" name="potvrda" value="da" required disabled={pending} />
        <span>
          Pregledao sam proveru. Stanje na dan {stockDate.split("-").reverse().join(".")}. ({new Intl.NumberFormat("sr-Latn-RS").format(lines)} stavki) postaje važeće stanje u portalu.
        </span>
      </label>
      <label className="portal-field lg-note">
        <span>Napomena (nije obavezna)</span>
        <input type="text" name="napomena" maxLength={500} disabled={pending} />
      </label>
      <div className="lg-actions">
        <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
          {pending ? "Potvrđujem…" : "Potvrdite lager"}
        </button>
        <span className="lg-hint">Traži prijavu sa drugim faktorom u poslednjih 10 minuta. Kupci ovo stanje ne vide.</span>
      </div>
      <Status state={state} />
    </form>
  );
}

export function StockDiscardForm({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(discardStockAction, INITIAL);
  return (
    <details className="lg-discard">
      <summary>Odbacite ovaj fajl</summary>
      <form action={action} className="lg-discard-form">
        <input type="hidden" name="importId" value={importId} />
        <label className="portal-field">
          <span>Razlog</span>
          <input type="text" name="razlog" required minLength={5} maxLength={500} disabled={pending} placeholder="npr. pogrešan datum izvoza" />
        </label>
        <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>
          Odbacite
        </button>
        <Status state={state} />
      </form>
    </details>
  );
}
