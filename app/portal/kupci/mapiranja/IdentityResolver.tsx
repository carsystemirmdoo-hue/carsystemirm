"use client";

import { useActionState, useState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  resolveIdentityAction,
  type IdentityActionState,
} from "@/app/portal/kupci/mapiranja/actions";
import {
  EXTERNAL_IDENTITY_LABELS,
  EXTERNAL_IDENTITY_TONES,
} from "@/lib/portal/status-labels";

const INITIAL: IdentityActionState = { error: null, ok: null };

export type IdentityRow = {
  id: string;
  sourceSystem: string;
  issuerCode: string;
  externalPartnerCode: string;
  sourceName: string | null;
  status: string;
  note: string | null;
  conflictReason: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPib: string | null;
  verifiedAt: Date | null;
};

export type CustomerOption = { id: string; name: string; pib: string };

/**
 * Ekran za ručno razrešavanje šifri partnera.
 *
 * Kupac se BIRA sa spiska, ne kuca. Slobodan unos bi značio da neko upiše
 * naziv i očekuje da ga sistem poveže — a povezivanje po nazivu je tačno ono
 * što ovaj model zabranjuje.
 */
export function IdentityResolver({
  rows,
  customers,
  canManage,
}: {
  rows: IdentityRow[];
  customers: CustomerOption[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(resolveIdentityAction, INITIAL);
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section className="portal-panel">
        <p>Za izabrani filter nema nijedne šifre partnera.</p>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      {state.error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Razrešenje nije sačuvano</strong>
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
              <th scope="col">Šifra partnera</th>
              <th scope="col">Izdavalac</th>
              <th scope="col">Naziv iz izvora</th>
              <th scope="col">Povezan kupac</th>
              <th scope="col">Stanje</th>
              {canManage ? <th scope="col">Radnja</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {/*
                    * Šifra se ispisuje doslovno, bez formatiranja i bez
                    * poravnanja po broju. Vodeća nula je deo vrednosti.
                    */}
                  <strong>{row.externalPartnerCode}</strong>
                  <small>{row.sourceSystem}</small>
                </td>
                <td>{row.issuerCode}</td>
                <td>
                  {row.sourceName ?? "—"}
                  <small>Naziv nije osnov povezivanja</small>
                </td>
                <td>
                  {row.customerName ? (
                    <>
                      <strong>{row.customerName}</strong>
                      {/* PIB je pomoć pri pregledu, ne kriterijum spajanja. */}
                      <small>PIB {row.customerPib}</small>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Badge tone={EXTERNAL_IDENTITY_TONES[row.status] ?? "neutral"}>
                    {EXTERNAL_IDENTITY_LABELS[row.status] ?? row.status}
                  </Badge>
                  {row.conflictReason ? <small>{row.conflictReason}</small> : null}
                  {row.note ? <small>{row.note}</small> : null}
                </td>
                {canManage ? (
                  <td>
                    <PortalButton
                      variant="ghost"
                      onClick={() => setOpenId(openId === row.id ? null : row.id)}
                    >
                      {openId === row.id ? "Zatvorite" : "Razrešite"}
                    </PortalButton>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && openId ? (
        <form action={formAction} className="portal-form">
          <input type="hidden" name="id" value={openId} />
          <Field label="Stanje" required>
            <select name="status" defaultValue="mapped" required>
              <option value="mapped">Povežite sa kupcem</option>
              <option value="unmapped">Ostavite nepovezano</option>
              <option value="disabled">Isključite šifru</option>
            </select>
          </Field>
          <Field
            label="Kupac"
            hint="Obavezno kada se šifra povezuje. Bira se sa spiska — naziv se ne kuca."
          >
            <select name="customerId" defaultValue="">
              <option value="">— bez kupca —</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · PIB {customer.pib}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Razlog" required hint="Upisuje se u trag revizije.">
            <input type="text" name="reason" minLength={3} maxLength={500} required />
          </Field>
          <PortalButton type="submit" disabled={pending}>
            {pending ? "Čuvanje…" : "Sačuvajte razrešenje"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
