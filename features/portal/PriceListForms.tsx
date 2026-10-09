"use client";

import { useActionState } from "react";
import { DateField } from "@/components/portal/DateField";
import {
  applyPriceListAction,
  discardPriceListAction,
  setBasePriceAction,
  uploadPriceListAction,
  type PriceListActionState,
} from "@/app/portal/cene/cenovnik/actions";

const INITIAL: PriceListActionState = { error: null, ok: null };

function Status({ state }: { state: PriceListActionState }) {
  if (state.error) return <p className="portal-login-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="portal-permission-ok" role="status">{state.ok}</p>;
  return null;
}

/** Otpremanje PDF-a. Fajl se čita i upisuje SAMO za pregled — cene se ne menjaju. */
export function PriceListUploadForm() {
  const [state, action, pending] = useActionState(uploadPriceListAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <label>
        <span>Cenovnik (PDF iz BizniSofta)</span>
        <input type="file" name="cenovnik" accept="application/pdf,.pdf" required disabled={pending} />
        <small>
          Izveštaj „Stanje zaliha – nabavna i VP cena“. Čita se samo VP cena; nabavna cena, stanje i marža se ne
          čuvaju. Isti fajl otpremljen ponovo otvara postojeći pregled.
        </small>
      </label>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>{pending ? "Čitam PDF…" : "Otpremite na pregled"}</button>
      <Status state={state} />
    </form>
  );
}

export type UnclearRow = { code: string; pdfName: string; portalName: string | null; price: string; note: string; applicable: boolean };

/** Primena: datum važenja bira gazda; nejasne stavke se uključuju samo pojedinačno. */
export function PriceListApplyForm({ importId, reportDate, defaultDate, unclear, toApply }: { importId: string; reportDate: string; defaultDate: string; unclear: UnclearRow[]; toApply: number }) {
  const [state, action, pending] = useActionState(applyPriceListAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form pl-apply">
      <input type="hidden" name="importId" value={importId} />
      {unclear.length ? (
        <fieldset className="pl-unclear">
          <legend>Nejasne stavke ({unclear.length}) — podrazumevano se NE primenjuju</legend>
          <p>Označite samo one za koje ste sigurni da je ista roba (isti artikal pod drugim nazivom).</p>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Primeniti</th><th>Šifra</th><th>Naziv u cenovniku</th><th>Naziv u portalu</th><th className="portal-table-number">VP cena</th><th>Razlog</th></tr></thead>
              <tbody>
                {unclear.map((u) => (
                  <tr key={u.code}>
                    <td>{u.applicable ? <input type="checkbox" name="nejasno" value={u.code} aria-label={`Primeniti ${u.code}`} disabled={pending} /> : "—"}</td>
                    <td>{u.code}</td><td>{u.pdfName}</td><td>{u.portalName ?? "—"}</td>
                    <td className="portal-table-number">{u.price}</td><td>{u.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      ) : null}
      <DateField
        name="vaziOd"
        label="Važi od"
        required
        defaultValue={defaultDate}
        disabled={pending}
        hint={`Datum u nazivu fajla i „Na dan“ (${reportDate.split("-").reverse().join(".")}) su datum stanja, ne početak važenja — izaberite ga sami (ne ranije od datuma stanja).`}
      />
      <label>
        <span>Napomena (opciono)</span>
        <input type="text" name="napomena" maxLength={500} disabled={pending} />
      </label>
      <label className="pl-check">
        <input type="checkbox" name="potvrda" value="da" required disabled={pending} />
        <span>Promene su pregledane. Iznosi su u dinarima (RSD), bez PDV-a. Primena upisuje {toApply} osnovnih cena (plus označene nejasne); rabati kupaca i fakture se ne menjaju.</span>
      </label>
      <small className="pl-mfa">Upis traži prijavu sa drugim faktorom u poslednjih 10 minuta. Ako je prošlo više, odjavite se i prijavite ponovo.</small>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>{pending ? "Primenjujem…" : "Primenite cenovnik"}</button>
      <Status state={state} />
    </form>
  );
}

export function PriceListDiscardForm({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(discardPriceListAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <input type="hidden" name="importId" value={importId} />
      <label>
        <span>Razlog odbacivanja</span>
        <input type="text" name="razlog" required minLength={5} maxLength={500} disabled={pending} />
      </label>
      <small className="pl-mfa">Upis traži prijavu sa drugim faktorom u poslednjih 10 minuta. Ako je prošlo više, odjavite se i prijavite ponovo.</small>
      <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>Odbacite cenovnik</button>
      <Status state={state} />
    </form>
  );
}

/** Pojedinačna izmena osnovne cene, uz datum važenja i obrazloženje. */
export function BasePriceForm({ defaultCode = "", defaultDate }: { defaultCode?: string; defaultDate: string }) {
  const [state, action, pending] = useActionState(setBasePriceAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <label><span>Šifra artikla</span><input type="text" name="sifra" required maxLength={32} defaultValue={defaultCode} disabled={pending} /></label>
      <label><span>Nova osnovna (VP) cena bez PDV-a, RSD</span><input type="text" name="cena" required inputMode="decimal" placeholder="1.250,00" disabled={pending} /></label>
      <label><span>PDV % (prazno = kao do sada)</span><input type="text" name="pdv" inputMode="decimal" maxLength={5} disabled={pending} /></label>
      <DateField name="vaziOd" label="Važi od" required defaultValue={defaultDate} disabled={pending} />
      <label><span>Obrazloženje</span><input type="text" name="obrazlozenje" required minLength={5} maxLength={500} disabled={pending} /></label>
      <label className="pl-check">
        <input type="checkbox" name="potvrda" value="da" required disabled={pending} />
        <span>Menjam osnovnu cenu. Rabati kupaca i izdate fakture ostaju kakvi jesu.</span>
      </label>
      <small className="pl-mfa">Upis traži prijavu sa drugim faktorom u poslednjih 10 minuta. Ako je prošlo više, odjavite se i prijavite ponovo.</small>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>{pending ? "Upisujem…" : "Upišite osnovnu cenu"}</button>
      <Status state={state} />
    </form>
  );
}
