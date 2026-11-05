"use client";

import { useActionState, useEffect, useState } from "react";
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
  const [mode, setMode] = useState("mapped");
  /*
   * Polja se drže u stanju: React posle slanja prazni nekontrolisan obrazac,
   * pa bi posle greške (npr. pogrešan PIB) i razlog morao da se kuca ponovo.
   */
  const [draft, setDraft] = useState({ pib: "", name: "", city: "", reason: "", customerId: "" });
  // Posle uspeha obrazac se zatvara; poruka ostaje iznad tabele.
  useEffect(() => {
    if (state.ok) setOpenId(null);
  }, [state]);
  const set = (key: keyof typeof draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  const openRow = rows.find((row) => row.id === openId) ?? null;
  // Nov kupac samo za šifru bez kupca (nov partner iz BizniSofta).
  const canCreate = openRow !== null && !openRow.customerId && (openRow.status === "unmapped" || openRow.status === "conflict");

  if (rows.length === 0) {
    // Poruka o uspehu ostaje i kada je razrešena poslednja šifra u filteru.
    return (
      <section className="portal-panel">
        {state.ok ? (
          <p className="portal-login-hint" role="status">
            {state.ok}
          </p>
        ) : null}
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
                      onClick={() => {
                        setOpenId(openId === row.id ? null : row.id);
                        setMode("mapped");
                        setDraft({ pib: "", name: row.sourceName ?? "", city: "", reason: "", customerId: "" });
                      }}
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
            <select name="status" value={mode} onChange={(e) => setMode(e.target.value)} required>
              <option value="mapped">Povežite sa kupcem</option>
              {canCreate ? <option value="create">Otvorite novog kupca i povežite</option> : null}
              <option value="unmapped">Ostavite nepovezano</option>
              <option value="disabled">Isključite šifru</option>
            </select>
          </Field>
          {mode === "create" && canCreate ? (
            <>
              <p className="portal-login-hint">
                Za novog partnera iz BizniSofta koga u portalu još nema. PIB i naziv prepišite sa
                kartice partnera u BizniSoftu — sistem ih ne pogađa. Ako kupac sa tim PIB-om već
                postoji, povežite šifru sa njim.
              </p>
              <Field label="PIB" required hint="Domaći PIB, 9 cifara; proverava se kontrolna cifra.">
                <input type="text" name="pib" inputMode="numeric" pattern="[0-9]{9}" maxLength={9} required value={draft.pib} onChange={set("pib")} />
              </Field>
              <Field label="Naziv kupca" required>
                <input type="text" name="name" value={draft.name} onChange={set("name")} minLength={2} maxLength={200} required />
              </Field>
              <Field label="Mesto">
                <input type="text" name="city" maxLength={120} value={draft.city} onChange={set("city")} />
              </Field>
            </>
          ) : (
            <Field
              label="Kupac"
              hint="Obavezno kada se šifra povezuje. Bira se sa spiska — naziv se ne kuca."
            >
              <select name="customerId" value={draft.customerId} onChange={set("customerId")}>
                <option value="">— bez kupca —</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · PIB {customer.pib}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Razlog" required hint="Upisuje se u trag revizije.">
            <input type="text" name="reason" minLength={3} maxLength={500} required value={draft.reason} onChange={set("reason")} />
          </Field>
          <PortalButton type="submit" disabled={pending}>
            {pending ? "Čuvanje…" : "Sačuvajte razrešenje"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
