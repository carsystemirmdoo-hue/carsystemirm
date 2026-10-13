"use client";

import { useActionState } from "react";
import { confirmStockAction, discardStockAction, uploadStockAction, type StockImportActionState } from "@/app/portal/zalihe/uvoz/actions";

const INITIAL: StockImportActionState = { error: null, ok: null };

function Status({ state }: { state: StockImportActionState }) {
  if (state.error) return <p className="portal-login-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="portal-permission-ok" role="status">{state.ok}</p>;
  return null;
}

/** Otpremanje izvoza. Fajl se čita i upisuje SAMO za pregled — važeći snimak se ne menja. */
export function StockUploadForm() {
  const [state, action, pending] = useActionState(uploadStockAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <label>
        <span>Lager (XLSX ili CSV iz BizniSofta)</span>
        <input
          type="file"
          name="lager"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          required
          disabled={pending}
        />
        <small>
          Izveštaj „Stanje zaliha“ za poslovni objekat 021 VELEPRODAJA, izvezen kakav jeste — bez sređivanja u Excel-u.
          Čitaju se šifra, naziv i količina; cene, vrednosti i marže se ne čuvaju. Isti fajl otpremljen ponovo otvara
          postojeći pregled.
        </small>
      </label>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>{pending ? "Čitam fajl…" : "Otpremite na pregled"}</button>
      <Status state={state} />
    </form>
  );
}

export function StockConfirmForm({ importId, lines, stockDate }: { importId: string; lines: number; stockDate: string }) {
  const [state, action, pending] = useActionState(confirmStockAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <input type="hidden" name="importId" value={importId} />
      <label>
        <span>Napomena (opciono)</span>
        <input type="text" name="napomena" maxLength={500} disabled={pending} />
      </label>
      <label className="pl-check">
        <input type="checkbox" name="potvrda" value="da" required disabled={pending} />
        <span>
          Pregledao sam izveštaj. Potvrdom {lines} stavki stanja na dan {stockDate.split("-").reverse().join(".")} postaje važeći snimak
          zaliha. Prikaz kupcima ostaje isključen dok se posebno ne uključi.
        </span>
      </label>
      <small className="pl-mfa">Upis traži prijavu sa drugim faktorom u poslednjih 10 minuta. Ako je prošlo više, odjavite se i prijavite ponovo.</small>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>{pending ? "Potvrđujem…" : "Potvrdite lager"}</button>
      <Status state={state} />
    </form>
  );
}

export function StockDiscardForm({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(discardStockAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <input type="hidden" name="importId" value={importId} />
      <label>
        <span>Razlog odbacivanja</span>
        <input type="text" name="razlog" required minLength={5} maxLength={500} disabled={pending} />
      </label>
      <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>Odbacite otpremanje</button>
      <Status state={state} />
    </form>
  );
}
