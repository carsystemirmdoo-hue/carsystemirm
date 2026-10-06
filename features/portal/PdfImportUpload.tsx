"use client";

import { useActionState, useState } from "react";
import { importPdfAction, type PdfImportState } from "@/app/portal/importi/pdf-actions";
import {
  formatMegabytes,
  MAX_PDF_FILES_PER_UPLOAD,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_REQUEST_BYTES,
  uploadSelectionError,
} from "@/lib/import/upload-limits.mjs";

const INITIAL: PdfImportState = { error: null, ok: null, summary: [] };

/**
 * Otpremanje BizniSoft PDF dokumenata.
 *
 * Ekran namerno ne prikazuje imena obrađenih fajlova ni podatke sa dokumenata —
 * samo zbir po ishodima. Pojedinačan dokument se otvara na pregledu, uz proveru
 * dozvola.
 */
export function PdfImportUpload() {
  const [state, formAction, pending] = useActionState(importPdfAction, INITIAL);
  // Provera izbora pre slanja: preveliko telo bi platforma odbila (413) pre
  // nego što akcija stigne da vrati razumljivu poruku.
  const [selectionError, setSelectionError] = useState<string | null>(null);

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Uvoz PDF dokumenata</h2>
          <p>
            Račun-otpremnice iz BizniSoft-a. Dokumenti se čitaju lokalno; fajlovi
            se ne čuvaju na serveru, ostaje samo otisak sadržaja.
          </p>
        </div>
      </div>

      <form action={formAction} className="portal-settings-form">
        <label>
          <span>Oznaka izdavaoca</span>
          <input
            type="text"
            name="izdavalac"
            required
            maxLength={16}
            defaultValue="CSRM"
            disabled={pending}
          />
          <small>
            Ista šifra partnera kod dva izdavaoca nije isti kupac, pa je oznaka
            obavezna.
          </small>
        </label>
        <label>
          <span>Dokumenti (PDF)</span>
          <input
            type="file"
            name="fajlovi"
            accept="application/pdf,.pdf"
            multiple
            required
            disabled={pending}
            onChange={(event) =>
              setSelectionError(uploadSelectionError(Array.from(event.currentTarget.files ?? [])))
            }
          />
          <small>
            Najviše {MAX_PDF_FILES_PER_UPLOAD} dokumenata u jednom otpremanju, pojedinačno do{" "}
            {formatMegabytes(MAX_UPLOAD_FILE_BYTES)} i ukupno do{" "}
            {formatMegabytes(MAX_UPLOAD_REQUEST_BYTES)}.
          </small>
          {selectionError ? (
            <small className="portal-login-error" role="alert">
              {selectionError}
            </small>
          ) : null}
        </label>
        <button
          type="submit"
          className="portal-button"
          data-variant="primary"
          disabled={pending || selectionError !== null}
        >
          {pending ? "Čitanje u toku…" : "Uvezite dokumente"}
        </button>

        {state.error ? (
          <p className="portal-login-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="portal-permission-ok" role="status">
            {state.ok}
          </p>
        ) : null}
      </form>

      {state.summary.length > 0 ? (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Ishod</th>
                <th scope="col">Dokumenata</th>
              </tr>
            </thead>
            <tbody>
              {state.summary.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className="portal-table-number">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="portal-phase-notice">
        <h3>Šta se dešava sa dokumentom</h3>
        <ul>
          <li>
            Zbir stavki mora da se poklopi sa odštampanim zbirom. Ako se ne
            poklapa, dokument ide u karantin i ne pravi promet.
          </li>
          <li>
            Tip dokumenta se čita iz naslova. Za oblik koji nema potvrđen uzorak
            sistem staje umesto da pogađa — storno se ne nagađa.
          </li>
          <li>
            Nemapirana šifra partnera ne otvara kupca. Dokument čeka, i knjiži se
            čim neko poveže šifru.
          </li>
        </ul>
      </div>
    </section>
  );
}
