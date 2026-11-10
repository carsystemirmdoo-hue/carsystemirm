"use client";

import { useActionState, useState, useTransition } from "react";
import { refreshDebtsAction, uploadDebtsAction, type DebtActionResult } from "./actions";

/** „Osveži sada“ i otpremanje tabele (2026-11-10). */
export function DebtTools({ canRefresh, canUpload }: { canRefresh: boolean; canUpload: boolean }) {
  const [msg, setMsg] = useState<DebtActionResult>(null);
  const [pending, start] = useTransition();
  const [upload, uploadAction, uploading] = useActionState(uploadDebtsAction, null);
  const shown = upload ?? msg;
  return (
    <div className="dg-tools">
      {canRefresh ? (
        <button type="button" className="dg-btn" disabled={pending} onClick={() => start(async () => setMsg(await refreshDebtsAction()))}>
          {pending ? "Čitam tabelu…" : "Osveži sada"}
        </button>
      ) : null}
      {canUpload ? (
        <form action={uploadAction} className="dg-upload">
          <label>
            <span>Ili otpremite tabelu (XLSX/CSV)</span>
            <input type="file" name="fajl" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required />
          </label>
          <button type="submit" className="dg-btn dg-btn--light" disabled={uploading}>{uploading ? "Učitavam…" : "Učitaj"}</button>
        </form>
      ) : null}
      {shown ? <p className={`dg-msg ${shown.ok ? "" : "dg-msg--err"}`} role="status">{shown.text}</p> : null}
    </div>
  );
}
