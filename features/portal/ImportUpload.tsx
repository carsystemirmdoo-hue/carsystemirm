"use client";

import { useActionState } from "react";
import { importFileAction, type ImportState } from "@/app/portal/importi/actions";

const INITIAL: ImportState = { error: null, ok: null, detail: null };

export function ImportUpload() {
  const [state, formAction, pending] = useActionState(importFileAction, INITIAL);

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Ručni uvoz izvoza faktura</h2>
          <p>
            CSV iz BiznisSoft-a. Isti fajl se prepoznaje po otisku sadržaja i ne
            uvozi se dvaput.
          </p>
        </div>
      </div>

      <form action={formAction} className="portal-settings-form">
        <label>
          <span>Fajl (CSV)</span>
          <input
            type="file"
            name="fajl"
            accept=".csv,text/csv,text/plain"
            required
            disabled={pending}
          />
          <small>Razdvajač `;` ili `,`. Najviše 20 MB.</small>
        </label>
        <label>
          <span>Datum podataka (opciono)</span>
          <input type="date" name="datum_podataka" disabled={pending} />
          <small>Radni dan na koji se izvoz odnosi.</small>
        </label>
        <button
          type="submit"
          className="portal-button"
          data-variant="primary"
          disabled={pending}
        >
          {pending ? "Uvoz u toku…" : "Uvezi fajl"}
        </button>

        {state.error ? (
          <p className="portal-login-error" role="alert">
            {state.error}
            {state.detail ? ` — ${state.detail}` : ""}
          </p>
        ) : null}
        {state.ok ? (
          <p className="portal-permission-ok" role="status">
            {state.ok}
            {state.detail ? ` — ${state.detail}` : ""}
          </p>
        ) : null}
      </form>

      <div className="portal-phase-notice">
        <h3>Očekivane kolone</h3>
        <ul>
          <li>
            Obavezno: <code>pib</code>, <code>kupac</code>,{" "}
            <code>broj_dokumenta</code>, <code>datum</code>,{" "}
            <code>vrsta_dokumenta</code>, <code>sifra_artikla</code>,{" "}
            <code>kolicina</code>, <code>cena</code>, <code>iznos_stavke</code>
          </li>
          <li>
            Opciono: <code>naziv_artikla</code>, <code>grupa_proizvoda</code>,{" "}
            <code>brend</code>, <code>jm</code>, <code>komercijalista</code>,{" "}
            <code>rabat</code>, <code>poreska_stopa</code>, <code>grad</code>,{" "}
            <code>redni_broj</code>
          </li>
          <li>
            Iznosi mogu biti u srpskom zapisu (1.234,56). Negativne količine i
            iznosi se čuvaju onakvi kakvi jesu.
          </li>
        </ul>
      </div>
    </section>
  );
}
