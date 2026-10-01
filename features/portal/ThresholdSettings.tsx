"use client";

import { useActionState } from "react";
import {
  saveThresholdsAction,
  type SettingsState,
} from "@/app/portal/admin/actions";

const INITIAL: SettingsState = { error: null, ok: null };

const FIELDS = [
  {
    name: "t70",
    label: "Prvo upozorenje (% limita)",
    hint: "Kupac se približava limitu.",
  },
  {
    name: "t90",
    label: "Drugo upozorenje (% limita)",
    hint: "Visoko zaduženje.",
  },
  {
    name: "t100",
    label: "Prekoračenje (% limita)",
    hint: "Limit je prekoračen.",
  },
  {
    name: "tDelay",
    label: "Ozbiljno kašnjenje (dana)",
    hint: "Primenjuje se tek kada postoji proveren izvor uplata.",
  },
] as const;

export function ThresholdSettings({
  thresholds,
  canManage,
}: {
  thresholds: { t70: number; t90: number; t100: number; tDelay: number };
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    saveThresholdsAction,
    INITIAL,
  );

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Pragovi upozorenja</h2>
          <p>
            {canManage
              ? "Vrednosti moraju rasti redom. Izmena važi za sve korisnike."
              : "Pragove menja isključivo Vlasnik; ovde je prikaz trenutnih vrednosti."}
          </p>
        </div>
      </div>

      <form action={formAction} className="portal-settings-form">
        {FIELDS.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            <input
              type="number"
              name={field.name}
              defaultValue={thresholds[field.name]}
              min={1}
              max={field.name === "tDelay" ? 365 : 200}
              required
              disabled={!canManage || pending}
            />
            <small>{field.hint}</small>
          </label>
        ))}

        {canManage ? (
          <>
            <label className="portal-settings-reason">
              <span>Razlog izmene (obavezno)</span>
              <input
                name="reason"
                minLength={3}
                maxLength={500}
                required
                disabled={pending}
                placeholder="npr. usklađivanje sa novom politikom naplate"
              />
            </label>
            <button
              type="submit"
              className="portal-button"
              data-variant="primary"
              disabled={pending}
            >
              {pending ? "Čuvanje…" : "Sačuvajte pragove"}
            </button>
          </>
        ) : null}

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
    </section>
  );
}
