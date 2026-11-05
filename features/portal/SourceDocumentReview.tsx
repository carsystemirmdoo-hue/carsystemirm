"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  closeReviewAction,
  resolveRevisionAction,
  type DocumentReviewState,
} from "@/app/portal/importi/dokumenti/actions";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  MANUAL_REVIEW_LABELS,
  MANUAL_REVIEW_TONES,
  SOURCE_DOCUMENT_REVISION_LABELS,
  SOURCE_DOCUMENT_REVISION_TONES,
  SOURCE_DOCUMENT_VALIDATION_LABELS,
  SOURCE_DOCUMENT_VALIDATION_TONES,
} from "@/lib/portal/status-labels";
import { dmy } from "@/lib/ordering/panelFormat.mjs";

const INITIAL: DocumentReviewState = { error: null, ok: null };

export type DocumentRow = {
  id: string;
  fileHash: string;
  pageCount: number;
  lineCount: number;
  issuerCode: string;
  externalPartnerCode: string | null;
  documentDate: string | null;
  validationStatus: string;
  validationDetail: string | null;
  revisionStatus: string;
  conflictReason: string | null;
  manualReview: string;
  posted: boolean;
  /** Proknjižena faktura (za vezu na detalj); `null` dok dokument nije proknjižen. */
  invoiceId: string | null;
  businessDocumentNumber: string | null;
  customerName: string | null;
  /** Storno: `waiting_original` | `applied` | `review`; `null` za ostale dokumente. */
  stornoStatus?: string | null;
  /** Original isključen iz prometa primenjenim stornom. */
  reversed?: boolean;
};

/**
 * Pregled uvezenih izvornih dokumenata.
 *
 * Ime fajla se ne prikazuje (ume da nosi putanju i proizvoljan tekst sa
 * računara). Broj računa i kupac se prikazuju (odluka vlasnika 2026-11-04):
 * ekran otvaraju samo uloge koje ionako vide sve kupce i sve fakture
 * (`view:importi` — Vlasnik, kancelarija, paket „analitika“ uz
 * `customers:view_all`), a bez broja kancelarija ne može da nađe dokument.
 */
const STORNO_STATUS_LABELS: Record<string, string> = {
  waiting_original: "čeka original",
  applied: "primenjeno",
  review: "na pregledu",
};

export function SourceDocumentReview({
  rows,
  canManage,
  canOpenInvoice = false,
}: {
  rows: DocumentRow[];
  canManage: boolean;
  /** `view:prodaja`: broj vodi na detalj fakture. */
  canOpenInvoice?: boolean;
}) {
  const [revisionState, revisionAction, revisionPending] = useActionState(
    resolveRevisionAction,
    INITIAL,
  );
  const [reviewState, reviewAction, reviewPending] = useActionState(
    closeReviewAction,
    INITIAL,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section className="portal-panel">
        <p>Za izabrani filter nema nijednog dokumenta.</p>
      </section>
    );
  }

  const conflicts = rows.filter((row) => row.revisionStatus === "conflict");

  return (
    <section className="portal-panel">
      {revisionState.error ? (
        <p className="portal-login-error" role="alert">{revisionState.error}</p>
      ) : null}
      {revisionState.ok ? (
        <p className="portal-permission-ok" role="status">{revisionState.ok}</p>
      ) : null}
      {reviewState.error ? (
        <p className="portal-login-error" role="alert">{reviewState.error}</p>
      ) : null}
      {reviewState.ok ? (
        <p className="portal-permission-ok" role="status">{reviewState.ok}</p>
      ) : null}

      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th scope="col">Dokument</th>
              <th scope="col">Izdavalac / partner</th>
              <th scope="col">Datum</th>
              <th scope="col">Strana</th>
              <th scope="col">Stavki</th>
              <th scope="col">Provera</th>
              <th scope="col">Verzija</th>
              <th scope="col">Pregled</th>
              <th scope="col">Promet</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-active={openId === row.id}>
                <th scope="row">
                  {row.businessDocumentNumber ? (
                    canOpenInvoice && row.invoiceId ? (
                      <Link href={`/portal/prodaja/faktura/${row.invoiceId}`}>{row.businessDocumentNumber}</Link>
                    ) : (
                      <span>{row.businessDocumentNumber}</span>
                    )
                  ) : (
                    <span>bez broja</span>
                  )}
                  <small>
                    <code>{row.fileHash.slice(0, 12)}…</code>
                  </small>
                </th>
                <td>
                  {row.customerName ?? <span>šifra nije povezana</span>}
                  <small>
                    {row.issuerCode} / {row.externalPartnerCode ?? "—"}
                  </small>
                </td>
                <td className="portal-nowrap">{row.documentDate ? dmy(row.documentDate.slice(0, 10)) : "—"}</td>
                <td className="portal-table-number">{row.pageCount}</td>
                <td className="portal-table-number">{row.lineCount}</td>
                <td>
                  <Badge tone={SOURCE_DOCUMENT_VALIDATION_TONES[row.validationStatus]}>
                    {SOURCE_DOCUMENT_VALIDATION_LABELS[row.validationStatus] ??
                      row.validationStatus}
                  </Badge>
                  {row.validationDetail ? <small>{row.validationDetail}</small> : null}
                </td>
                <td>
                  <Badge tone={SOURCE_DOCUMENT_REVISION_TONES[row.revisionStatus]}>
                    {SOURCE_DOCUMENT_REVISION_LABELS[row.revisionStatus] ??
                      row.revisionStatus}
                  </Badge>
                  {row.conflictReason ? <small>{row.conflictReason}</small> : null}
                </td>
                <td>
                  <Badge tone={MANUAL_REVIEW_TONES[row.manualReview]}>
                    {MANUAL_REVIEW_LABELS[row.manualReview] ?? row.manualReview}
                  </Badge>
                </td>
                <td>
                  {row.posted ? "Proknjiženo" : "Nije proknjiženo"}
                  {row.reversed ? " · stornirano, van prometa" : ""}
                  {row.stornoStatus ? ` · storno: ${STORNO_STATUS_LABELS[row.stornoStatus] ?? row.stornoStatus}` : ""}
                </td>
                <td>
                  {canManage && row.manualReview === "pending" ? (
                    <PortalButton
                      type="button"
                      variant="ghost"
                      onClick={() => setOpenId(openId === row.id ? null : row.id)}
                    >
                      {openId === row.id ? "Zatvorite" : "Rešite"}
                    </PortalButton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId ? (
        <div className="portal-phase-notice">
          <h3>Razrešenje dokumenta</h3>

          {conflicts.some((row) => row.id === openId) ? (
            <form action={revisionAction} className="portal-settings-form">
              <input type="hidden" name="supersedingId" value={openId} />
              <Field label="Verzija koja se zamenjuje">
                <select name="supersededId" required disabled={revisionPending}>
                  <option value="">— izaberite raniju verziju —</option>
                  {rows
                    .filter((row) => row.id !== openId)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.fileHash.slice(0, 12)}… · {row.documentDate ? dmy(row.documentDate.slice(0, 10)) : "bez datuma"}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label="Razlog"
                hint="Zapisuje se u trag revizije. Ranija verzija se ne briše."
              >
                <input type="text" name="reason" required minLength={3} maxLength={500} />
              </Field>
              <PortalButton type="submit" variant="primary" disabled={revisionPending}>
                {revisionPending ? "Upisujem…" : "Ova verzija važi"}
              </PortalButton>
            </form>
          ) : (
            <form action={reviewAction} className="portal-settings-form">
              <input type="hidden" name="sourceDocumentId" value={openId} />
              <Field
                label="Napomena"
                hint="Zatvaranje pregleda ne pretvara dokument u validan i ne pravi promet."
              >
                <input type="text" name="note" required minLength={3} maxLength={500} />
              </Field>
              <PortalButton type="submit" variant="primary" disabled={reviewPending}>
                {reviewPending ? "Upisujem…" : "Zatvorite pregled"}
              </PortalButton>
            </form>
          )}
        </div>
      ) : null}
    </section>
  );
}
