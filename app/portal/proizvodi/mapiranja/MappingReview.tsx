"use client";

import { useActionState, useState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  decideMappingAction,
  proposeMappingAction,
  type MappingActionState,
} from "@/app/portal/proizvodi/mapiranja/actions";
import {
  PRODUCT_MAPPING_LABELS,
  PRODUCT_MAPPING_TONES,
} from "@/lib/portal/status-labels";

const INITIAL: MappingActionState = { error: null, ok: null };

export type MappingRow = {
  articleId: string;
  articleCode: string;
  articleName: string;
  brand: string | null;
  productGroup: string | null;
  status: string;
  catalogProductSlug: string | null;
  catalogVariantId: string | null;
  note: string | null;
  conflictReason: string | null;
};

export function MappingReview({
  rows,
  canManage,
}: {
  rows: MappingRow[];
  canManage: boolean;
}) {
  const [proposeState, proposeAction, proposing] = useActionState(
    proposeMappingAction,
    INITIAL,
  );
  const [decideState, decideAction, deciding] = useActionState(
    decideMappingAction,
    INITIAL,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const message = decideState.ok ?? proposeState.ok;
  const error = decideState.error ?? proposeState.error;
  const open = rows.find((row) => row.articleId === openId) ?? null;

  if (rows.length === 0) {
    return (
      <section className="portal-panel">
        <p>Za izabrani filter nema nijednog artikla.</p>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      {error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Radnja nije izvršena</strong>
            <small>{error}</small>
          </span>
        </div>
      ) : null}
      {message ? (
        <p className="portal-login-hint" role="status">
          {message}
        </p>
      ) : null}

      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th scope="col">Šifra artikla</th>
              <th scope="col">Naziv</th>
              <th scope="col">Brend / grupa</th>
              <th scope="col">Kataloški proizvod</th>
              <th scope="col">Stanje</th>
              {canManage ? <th scope="col">Radnja</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.articleId}>
                <td>
                  <strong>{row.articleCode}</strong>
                </td>
                <td>{row.articleName}</td>
                <td>
                  {row.brand ?? "—"}
                  <small>{row.productGroup ?? "bez grupe"}</small>
                </td>
                <td>
                  {row.status === "mapped" && row.catalogProductSlug ? (
                    <>
                      <strong>{row.catalogProductSlug}</strong>
                      {row.catalogVariantId ? (
                        <small>varijanta: {row.catalogVariantId}</small>
                      ) : null}
                    </>
                  ) : row.catalogProductSlug ? (
                    <>
                      {row.catalogProductSlug}
                      {/*
                        * Predložena veza NE otvara ni sliku ni PDP. Prikazuje se
                        * kao kandidat, i to mora biti vidljivo iz same ćelije.
                        */}
                      <small>samo predlog — bez slike i bez PDP-a</small>
                    </>
                  ) : (
                    <>
                      —
                      <small>artikal ostaje vidljiv interno</small>
                    </>
                  )}
                </td>
                <td>
                  <Badge tone={PRODUCT_MAPPING_TONES[row.status] ?? "neutral"}>
                    {PRODUCT_MAPPING_LABELS[row.status] ?? row.status}
                  </Badge>
                  {row.conflictReason ? <small>{row.conflictReason}</small> : null}
                  {row.note ? <small>{row.note}</small> : null}
                </td>
                {canManage ? (
                  <td>
                    <form action={proposeAction} style={{ display: "inline" }}>
                      <input type="hidden" name="articleId" value={row.articleId} />
                      <PortalButton type="submit" variant="ghost" disabled={proposing}>
                        Predloži po šifri
                      </PortalButton>
                    </form>
                    <PortalButton
                      variant="ghost"
                      onClick={() =>
                        setOpenId(openId === row.articleId ? null : row.articleId)
                      }
                    >
                      {openId === row.articleId ? "Zatvori" : "Odluči"}
                    </PortalButton>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && open ? (
        <form action={decideAction} className="portal-form">
          <input type="hidden" name="articleId" value={open.articleId} />
          <h3>
            {open.articleCode} — {open.articleName}
          </h3>
          <Field label="Odluka" required>
            <select name="status" defaultValue="mapped" required>
              <option value="mapped">Potvrdi vezu</option>
              {/*
                * Odbijanje i poništavanje su različiti događaji i ne nude se
                * zajedno: predlog se odbija, potvrđena veza se poništava.
                * Ponuda oba iz istog stanja bi značila da razlika zavisi od
                * toga šta je korisnik slučajno izabrao.
                */}
              {open.status === "mapped" ? (
                <option value="revoked">Poništi potvrđenu vezu</option>
              ) : (
                <option value="rejected">Odbij predlog</option>
              )}
              <option value="unmapped">Vrati u nemapirano</option>
            </select>
          </Field>
          <Field
            label="Slug kataloškog proizvoda"
            hint="Obavezno pri potvrdi. Potvrda bez proizvoda ne znači ništa."
          >
            <input
              type="text"
              name="catalogProductSlug"
              defaultValue={open.catalogProductSlug ?? ""}
              maxLength={200}
            />
          </Field>
          <Field label="Varijanta" hint="Opciono, kada izvor razlikuje varijante.">
            <input
              type="text"
              name="catalogVariantId"
              defaultValue={open.catalogVariantId ?? ""}
              maxLength={200}
            />
          </Field>
          <Field label="Razlog" required hint="Upisuje se u trag revizije.">
            <input type="text" name="note" minLength={3} maxLength={500} required />
          </Field>
          <PortalButton type="submit" disabled={deciding}>
            {deciding ? "Čuvanje…" : "Sačuvaj odluku"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
