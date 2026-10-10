"use client";

import { useActionState, useState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  transitionRuleAction,
  type PriceActionState,
} from "@/app/portal/cene/actions";
import {
  describeScope,
  describeValue,
  PRICE_RULE_STATUS_LABELS,
  PRICE_RULE_STATUS_TONES,
} from "@/lib/portal/status-labels";
import { dmy } from "@/lib/ordering/panelFormat.mjs";

const INITIAL: PriceActionState = { error: null, ok: null };

export type RuleRow = {
  id: string;
  status: string;
  precedenceLevel: number;
  precedenceLabel: string | null;
  customerScope: string;
  customerName: string | null;
  customerGroupName: string | null;
  productScope: string;
  articleCode: string | null;
  articleName: string | null;
  productGroup: string | null;
  brand: string | null;
  valueKind: string;
  discountPercent: string | null;
  netPrice: string | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  decisionReason: string | null;
  officeRecordNote: string | null;
  reconciliationNote: string | null;
  proposedByName: string | null;
  decidedByName: string | null;
  officeRecordedByName: string | null;
  /** `false` = važi samo u portalu; nije nalog za unos u BizniSoft (0035). */
  biznisoftEntryRequired?: boolean;
  sourceBatch?: string | null;
};

/** Radnje za red; pravilo „samo portal" nema evidentiranje unosa u BizniSoft. */
function actionsFor(row: RuleRow) {
  const list = ACTIONS[row.status] ?? [];
  return row.biznisoftEntryRequired === false ? list.filter((a) => a.to !== "office_recorded") : list;
}

/** Prelazi ponuđeni iz datog stanja, sa nazivom radnje. */
const ACTIONS: Record<string, { to: string; label: string; needsReason: boolean }[]> = {
  pending_approval: [
    { to: "approved_pending_biznisoft", label: "Odobrite", needsReason: false },
    { to: "rejected", label: "Odbijte", needsReason: true },
    { to: "revoked", label: "Opozovite", needsReason: true },
  ],
  /*
   * `confirmed` i `reconciliation_failed` NAMERNO nisu ponuđeni nigde.
   *
   * Ta dva stanja nisu odluka nego nalaz usaglašavanja sa fakturom, i postavlja
   * ih isključivo budući read-only reconciliation servis. Čovek iz portala ne
   * vidi fakturu — vidi samo šta misli da je uneo u BizniSoft.
   */
  approved_pending_biznisoft: [
    {
      to: "office_recorded",
      label: "Evidentirajte unos u BizniSoft",
      needsReason: true,
    },
    { to: "revoked", label: "Opozovite", needsReason: true },
    { to: "expired", label: "Označite isteklim", needsReason: false },
  ],
  office_recorded: [
    { to: "revoked", label: "Opozovite", needsReason: true },
    { to: "expired", label: "Označite isteklim", needsReason: false },
  ],
  reconciliation_failed: [
    {
      to: "office_recorded",
      label: "Ponovo evidentiraj unos u BizniSoft",
      needsReason: true,
    },
    { to: "revoked", label: "Opozovite", needsReason: true },
  ],
  confirmed: [
    { to: "revoked", label: "Opozovite", needsReason: true },
    { to: "expired", label: "Označite isteklim", needsReason: false },
  ],
};

export function RuleTable({
  rows,
  showActions = false,
}: {
  rows: RuleRow[];
  showActions?: boolean;
}) {
  const [state, formAction, pending] = useActionState(transitionRuleAction, INITIAL);
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section className="portal-panel">
        <p>Nema pravila za prikaz.</p>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      {state.error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Radnja nije izvršena</strong>
            <small>{state.error}</small>
          </span>
        </div>
      ) : null}
      {state.ok ? (
        <p className="portal-login-hint" role="status">
          {state.ok}
        </p>
      ) : null}

      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th scope="col">Klasa</th>
              <th scope="col">Opseg</th>
              <th scope="col">Vrednost</th>
              <th scope="col">Važenje</th>
              <th scope="col">Stanje</th>
              <th scope="col">Ko i zašto</th>
              {showActions ? <th scope="col">Radnja</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.precedenceLevel}</strong>
                  <small>{row.precedenceLabel}</small>
                </td>
                <td>{describeScope(row)}</td>
                <td>{describeValue(row)}</td>
                <td>
                  <span className="portal-nowrap">od {dmy(row.effectiveFrom)}</span>
                  <small>{row.effectiveTo ? `do ${dmy(row.effectiveTo)}` : "bez roka"}</small>
                </td>
                <td>
                  <Badge tone={PRICE_RULE_STATUS_TONES[row.status] ?? "neutral"}>
                    {PRICE_RULE_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                  {/*
                    * Razlika odobreno/potvrđeno se ispisuje uz svako pravilo,
                    * ne samo bojom. Boja se izgubi u štampi i u izvozu.
                    */}
                  {row.biznisoftEntryRequired === false ? (
                    <small className="rr-portal-only">
                      Važi samo u portalu — nije nalog za unos u BizniSoft.
                      {row.sourceBatch ? ` Serija ${row.sourceBatch}.` : ""}
                    </small>
                  ) : row.status === "approved_pending_biznisoft" ? (
                    <small>Još nije uneto u BizniSoft.</small>
                  ) : null}
                  {row.status === "office_recorded" ? (
                    <small>
                      Tvrdnja kancelarije, ne dokaz sa fakture.
                      {row.officeRecordNote ? ` ${row.officeRecordNote}` : ""}
                    </small>
                  ) : null}
                  {row.status === "confirmed" && row.reconciliationNote ? (
                    <small>{row.reconciliationNote}</small>
                  ) : null}
                </td>
                <td>
                  <small>Predložio: {row.proposedByName ?? "—"}</small>
                  <small>{row.reason}</small>
                  {row.decidedByName ? (
                    <small>Odlučio: {row.decidedByName}</small>
                  ) : null}
                  {row.decisionReason ? <small>{row.decisionReason}</small> : null}
                  {row.officeRecordedByName ? (
                    <small>Unos evidentirao: {row.officeRecordedByName}</small>
                  ) : null}
                </td>
                {showActions ? (
                  <td>
                    {actionsFor(row).length > 0 ? (
                      <PortalButton
                        variant="ghost"
                        onClick={() => setOpenId(openId === row.id ? null : row.id)}
                      >
                        {openId === row.id ? "Zatvorite" : "Odlučite"}
                      </PortalButton>
                    ) : (
                      <small>Nema dostupnih radnji</small>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showActions && openId ? (
        <form action={formAction} className="portal-form">
          <input type="hidden" name="ruleId" value={openId} />
          <Field label="Radnja" required>
            <select name="to" required>
              {(rows.find((row) => row.id === openId) ? actionsFor(rows.find((row) => row.id === openId)!) : []).map(
                (action) => (
                  <option key={action.to} value={action.to}>
                    {action.label}
                    {action.needsReason ? " (traži razlog)" : ""}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field
            label="Razlog"
            hint="Obavezan za odbijanje, opoziv i neuspelo usaglašavanje."
          >
            <input type="text" name="reason" maxLength={500} />
          </Field>
          <Field
            label="Napomena o unosu u BizniSoft"
            hint="Obavezna pri evidentiranju unosa — jedini trag o tome ŠTA je uneto."
          >
            <input type="text" name="officeRecordNote" maxLength={500} />
          </Field>
          <PortalButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Čuvanje…" : "Potvrdite radnju"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
