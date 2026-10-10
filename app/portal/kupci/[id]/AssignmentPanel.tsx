"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  assignCustomerAction,
  removeAssignmentAction,
  type AssignmentActionState,
} from "./actions";
import { dmy } from "@/lib/ordering/panelFormat.mjs";

const INITIAL: AssignmentActionState = { error: null, ok: null };

const BASIS_LABELS: Record<string, string> = {
  manual: "ručna dodela",
  biznisoft_rep_code: "šifra komercijaliste u BizniSoftu",
};

export function AssignmentPanel({
  customerId,
  assignees,
  reps,
  canManage,
}: {
  customerId: string;
  assignees: { userId: string; name: string; basis: string; assignedAt: Date }[];
  reps: { id: string; name: string; codes: string[] }[];
  canManage: boolean;
}) {
  const [addState, addAction, adding] = useActionState(assignCustomerAction, INITIAL);
  const [removeState, removeAction, removing] = useActionState(removeAssignmentAction, INITIAL);
  const state = removeState.error || removeState.ok ? removeState : addState;

  return (
    <section className="portal-panel">
      <h2>Komercijalisti</h2>
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
      {assignees.length === 0 ? (
        <p>Kupac nije dodeljen nijednom komercijalisti — vide ga samo Vlasnik i kancelarija.</p>
      ) : (
        <ul className="portal-plain-list">
          {assignees.map((a) => (
            <li key={a.userId}>
              <strong>{a.name}</strong>{" "}
              <small>
                {BASIS_LABELS[a.basis] ?? a.basis} · od{" "}
                {dmy(new Date(a.assignedAt))}
              </small>
              {canManage ? (
                <form action={removeAction} className="portal-inline-form">
                  <input type="hidden" name="customerId" value={customerId} />
                  <input type="hidden" name="userId" value={a.userId} />
                  <input
                    type="text"
                    name="reason"
                    placeholder="Razlog oduzimanja"
                    aria-label={`Razlog oduzimanja za ${a.name}`}
                    minLength={3}
                    maxLength={500}
                    required
                  />
                  <PortalButton type="submit" variant="ghost" disabled={removing}>
                    Oduzmite
                  </PortalButton>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form action={addAction} className="portal-form">
          <input type="hidden" name="customerId" value={customerId} />
          <Field label="Dodelite komercijalisti" required>
            <select name="userId" required defaultValue="">
              <option value="">— izaberite —</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.codes.length ? ` · šifra ${r.codes.join(", ")}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Razlog" required hint="Upisuje se u trag revizije.">
            <input type="text" name="reason" minLength={3} maxLength={500} required />
          </Field>
          <PortalButton type="submit" variant="primary" disabled={adding}>
            {adding ? "Čuvanje…" : "Dodelite"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
