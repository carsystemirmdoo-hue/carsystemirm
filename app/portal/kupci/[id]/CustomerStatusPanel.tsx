"use client";

import { useActionState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import { setCustomerStatusAction, type AssignmentActionState } from "./actions";

const INITIAL: AssignmentActionState = { error: null, ok: null };

/**
 * Status kupca: aktivan ili neaktivan (više ne radi sa nama). Promena traži
 * razlog i ide u trag revizije; istorija, veze i kartica ostaju.
 */
export function CustomerStatusPanel({
  customerId,
  active,
  canManage,
}: {
  customerId: string;
  active: boolean;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(setCustomerStatusAction, INITIAL);
  return (
    <section className="portal-panel" aria-labelledby="cs-status-title">
      <h2 id="cs-status-title">
        Status kupca <Badge tone={active ? "success" : "neutral"}>{active ? "Aktivan" : "Neaktivan"}</Badge>
      </h2>
      <p>
        {active
          ? "Neaktivan kupac ostaje sa svim fakturama i vezama, ali se ne prikazuje na „Za razgovor“, u predlozima ni u pozivima za nalog."
          : "Kupac je označen kao neaktivan: istorija i veze su dostupne, a „Za razgovor“, predlozi i pozivi ga izostavljaju."}
      </p>
      {state.error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Izmena nije sačuvana</strong>
            <small>{state.error}</small>
          </span>
        </div>
      ) : null}
      {state.ok ? (
        <p className="portal-login-hint" role="status">
          {state.ok}
        </p>
      ) : null}
      {canManage ? (
        <form action={action} className="portal-form">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="active" value={active ? "0" : "1"} />
          <Field label="Razlog" required hint="Upisuje se u trag revizije. Datum prestanka upišite samo ako je potvrđen.">
            <input type="text" name="reason" minLength={3} maxLength={500} required />
          </Field>
          <PortalButton type="submit" variant={active ? "ghost" : "secondary"} disabled={pending}>
            {active ? "Označite kao neaktivnog" : "Vratite u aktivne"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
