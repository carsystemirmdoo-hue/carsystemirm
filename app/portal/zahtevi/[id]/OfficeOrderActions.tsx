"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmOrderAction,
  recordBiznisoftAction,
  rejectOrderAction,
  requestChangesAction,
  takeIntoReviewAction,
} from "../actions";

type Result = { ok: true; changed: boolean } | { ok: false; message: string };

/**
 * Koraci kancelarije. Prikazuje se samo ono što je u ovom stanju dozvoljeno;
 * server svejedno proverava prelaz i sposobnost.
 */
export function OfficeOrderActions({
  orderId,
  status,
  canReview,
  canConfirm,
  biznisoftDocumentNumber,
}: {
  orderId: string;
  status: string;
  canReview: boolean;
  canConfirm: boolean;
  biznisoftDocumentNumber: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [doc, setDoc] = useState("");

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.message);
      if (r.ok) router.refresh();
    });

  if (!canReview && !canConfirm) {
    return (
      <div className="portal-panel-body kk-actions">
        <p className="kk-fine">Samo pregled. Prijem i potvrdu radi kancelarija.</p>
      </div>
    );
  }

  return (
    <div className="portal-panel-body kk-office">
      {status === "submitted" && canReview ? (
        <div className="kk-step">
          <h3>1. Prijem</h3>
          <p>Preuzmite zahtev u obradu da kupac vidi da je u radu.</p>
          <button type="button" className="portal-button" disabled={pending} onClick={() => run(() => takeIntoReviewAction(orderId))}>
            Preuzmi u obradu
          </button>
        </div>
      ) : null}

      {status === "under_review" ? (
        <div className="kk-step">
          <h3>2. Provera i odluka</h3>
          <p>Proverite artikle, količine i cene prema BizniSoftu. Potvrda dodeljuje broj porudžbine i obavezuje prema kupcu.</p>
          <div className="kk-step-actions">
            {canConfirm ? (
              <button
                type="button"
                className="portal-button"
                disabled={pending}
                onClick={() => {
                  if (confirm("Potvrditi porudžbinu? Kupac će videti broj porudžbine.")) run(() => confirmOrderAction(orderId));
                }}
              >
                Potvrdi porudžbinu
              </button>
            ) : null}
          </div>
          {canReview ? (
            <label className="kk-reason">
              <span>Razlog (obavezan za izmenu i odbijanje; kupac ga vidi)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} disabled={pending} />
              <span className="kk-step-actions">
                <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => run(() => requestChangesAction(orderId, reason))}>
                  Traži izmenu
                </button>
                <button type="button" className="portal-button" data-variant="ghost" disabled={pending} onClick={() => run(() => rejectOrderAction(orderId, reason))}>
                  Odbij zahtev
                </button>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {status === "confirmed" && canConfirm ? (
        <div className="kk-step">
          <h3>3. Unos u BizniSoft (ručno, pilot)</h3>
          {biznisoftDocumentNumber ? (
            <p>
              Upisan broj dokumenta <strong>{biznisoftDocumentNumber}</strong>.
            </p>
          ) : (
            <>
              <p>Unesite porudžbinu u BizniSoft i ovde upišite broj dokumenta koji je BizniSoft dodelio.</p>
              <span className="kk-step-actions">
                <input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Broj dokumenta iz BizniSofta" aria-label="Broj dokumenta iz BizniSofta" disabled={pending} maxLength={60} />
                <button type="button" className="portal-button" disabled={pending} onClick={() => run(() => recordBiznisoftAction(orderId, doc))}>
                  Upiši broj
                </button>
              </span>
            </>
          )}
        </div>
      ) : null}

      {["changes_requested", "rejected", "cancelled"].includes(status) ? (
        <p className="kk-fine">Nema daljih koraka za kancelariju u ovom stanju.</p>
      ) : null}
      {error ? <p className="kk-problem" role="alert">{error}</p> : null}
    </div>
  );
}
