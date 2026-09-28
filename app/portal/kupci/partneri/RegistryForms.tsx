"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  applyPlanAction,
  linkPartnerAction,
  linkRepCodeAction,
  uploadRegistryAction,
  type RegistryActionState,
} from "./actions";

const INITIAL: RegistryActionState = { error: null, ok: null };

function Feedback({ state, failTitle }: { state: RegistryActionState; failTitle: string }) {
  if (state.error) {
    return (
      <div className="portal-login-error" role="alert">
        <span>
          <strong>{failTitle}</strong>
          <small>{state.error}</small>
        </span>
      </div>
    );
  }
  if (state.ok) {
    return (
      <p className="portal-login-hint" role="status">
        {state.ok}
      </p>
    );
  }
  return null;
}

export function UploadForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(uploadRegistryAction, INITIAL);
  return (
    <section className="portal-panel">
      <h2>Uvoz registra partnera</h2>
      {!enabled ? (
        <p>
          Uvoz je isključen u ovom okruženju (<code>FEATURE_PARTNER_REGISTRY</code>). Registar nosi
          e-poštu i telefone iz izvora i ne ulazi u produkcionu bazu pre odluke vlasnika. Za pregled
          fajla bez baze koristite <code>scripts/partners/partner-registry-report.mjs</code>.
        </p>
      ) : (
        <form action={action} className="portal-form">
          <Feedback state={state} failTitle="Uvoz nije izvršen" />
          <Field label="Izvoz partnera (XLSX)" required hint="Struktura se proverava; promenjene kolone zaustavljaju uvoz.">
            <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
          </Field>
          <Field label="Izdavalac" required hint="Ista oznaka kao pri uvozu faktura.">
            <input type="text" name="issuerCode" pattern="[A-Za-z0-9._\-]{1,64}" required />
          </Field>
          <PortalButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Uvoz…" : "Uvezi snimak"}
          </PortalButton>
        </form>
      )}
    </section>
  );
}

export function LinkPartnerForm({
  issuerCode,
  partnerCode,
  canCreate,
  attachTo,
}: {
  issuerCode: string;
  partnerCode: string;
  canCreate: boolean;
  attachTo: { id: string; name: string } | null;
}) {
  const [state, action, pending] = useActionState(linkPartnerAction, INITIAL);
  if (!canCreate && !attachTo) return <small>nije povezan · PIB traži proveru</small>;
  return (
    <form action={action} className="portal-inline-form">
      <input type="hidden" name="issuerCode" value={issuerCode} />
      <input type="hidden" name="partnerCode" value={partnerCode} />
      <input type="hidden" name="mode" value={attachTo ? "attach" : "create"} />
      {attachTo ? <input type="hidden" name="customerId" value={attachTo.id} /> : null}
      <input
        type="text"
        name="reason"
        placeholder="Razlog"
        aria-label={`Razlog povezivanja šifre ${partnerCode}`}
        minLength={3}
        maxLength={500}
        required
      />
      <PortalButton type="submit" variant="ghost" disabled={pending}>
        {attachTo ? `Pripoji: ${attachTo.name} (isti PIB)` : "Otvori kupca"}
      </PortalButton>
      {state.error ? <small data-tone="danger">{state.error}</small> : null}
      {state.ok ? <small data-tone="success">{state.ok}</small> : null}
    </form>
  );
}

export function RepCodeForm({
  codes,
  reps,
}: {
  codes: { code: string; linkedName: string | null }[];
  reps: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(linkRepCodeAction, INITIAL);
  return (
    <>
      <Feedback state={state} failTitle="Šifra nije povezana" />
      <ul className="portal-plain-list">
        {codes.map((c) => (
          <li key={c.code}>
            <strong>Šifra {c.code}</strong>
            <small>{c.linkedName ? `povezana: ${c.linkedName}` : "nije povezana"}</small>
            <form action={action} className="portal-inline-form">
              <input type="hidden" name="sourceCode" value={c.code} />
              <select name="userId" required defaultValue="" aria-label={`Komercijalista za šifru ${c.code}`}>
                <option value="">— komercijalista —</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <PortalButton type="submit" variant="ghost" disabled={pending}>
                {c.linkedName ? "Promeni" : "Poveži"}
              </PortalButton>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PlanApply({ issuerCode, disabled }: { issuerCode: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(applyPlanAction, INITIAL);
  return (
    <form action={action} className="portal-form">
      <Feedback state={state} failTitle="Plan nije primenjen" />
      <input type="hidden" name="issuerCode" value={issuerCode} />
      <PortalButton type="submit" variant="primary" disabled={pending || disabled}>
        {pending ? "Primena…" : "Primeni predložene dodele"}
      </PortalButton>
    </form>
  );
}
