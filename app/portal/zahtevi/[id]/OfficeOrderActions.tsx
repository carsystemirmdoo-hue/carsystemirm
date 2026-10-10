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

type Result = { ok: true; changed: boolean } | { ok: false; message: string; stale?: { currentId: string; currentNumber: string } };

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
  onRequestLines = 0,
  version,
}: {
  orderId: string;
  status: string;
  canReview: boolean;
  canConfirm: boolean;
  biznisoftDocumentNumber: string | null;
  onRequestLines?: number;
  /** Oznaka prikazane verzije — server odbija radnju ako se zahtev u međuvremenu promenio. */
  version: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<{ currentId: string; currentNumber: string } | null>(null);
  const [reason, setReason] = useState("");
  const [doc, setDoc] = useState("");

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.message);
      setStale(!r.ok && r.stale ? r.stale : null);
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
    <div className="portal-panel-body kk-office" data-unsaved={reason.trim() || doc.trim() ? "true" : undefined}>
      {status === "submitted" && canReview ? (
        <div className="kk-step">
          <h3>1. Prijem</h3>
          <p>Preuzmite zahtev u obradu da kupac vidi da je u radu.</p>
          <button type="button" className="portal-button" disabled={pending} onClick={() => run(() => takeIntoReviewAction(orderId, version))}>
            Preuzmite u obradu
          </button>
        </div>
      ) : null}

      {status === "under_review" ? (
        <div className="kk-step">
          <h3>2. Provera i odluka</h3>
          <p>Proverite artikle, količine i cene prema BizniSoftu. Potvrda dodeljuje broj porudžbine i obavezuje prema kupcu.</p>
          {onRequestLines > 0 ? (
            <p className="kk-fine">
              Stavke na upit: {onRequestLines}. Potvrda je moguća tek kada sve stavke imaju cenu — pripremite izmenjen predlog
              (posle odobrenja rabata u „Rabati kupca“) ili ga pošaljite bez tih stavki; kupac ga potvrđuje.
            </p>
          ) : null}
          <div className="kk-step-actions">
            {canConfirm ? (
              <button
                type="button"
                className="portal-button"
                disabled={pending || onRequestLines > 0}
                onClick={() => {
                  if (confirm("Potvrditi porudžbinu? Kupac će videti broj porudžbine.")) run(() => confirmOrderAction(orderId, version));
                }}
              >
                Potvrdite porudžbinu
              </button>
            ) : null}
          </div>
          {canReview ? (
            <label className="kk-reason">
              <span>Razlog (obavezan za izmenu i odbijanje; kupac ga vidi)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} disabled={pending} />
              <span className="kk-step-actions">
                <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => run(() => requestChangesAction(orderId, reason, version))}>
                  Tražite izmenu
                </button>
                <button type="button" className="portal-button" data-variant="ghost" disabled={pending} onClick={() => run(() => rejectOrderAction(orderId, reason, version))}>
                  Odbijte zahtev
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
                <button type="button" className="portal-button" disabled={pending} onClick={() => run(() => recordBiznisoftAction(orderId, doc, version))}>
                  Upišite broj
                </button>
              </span>
            </>
          )}
        </div>
      ) : null}

      {status === "changes_requested" ? (
        <p className="kk-fine">Čeka se kupac. Ako je kupac odbio izmenjen predlog, ispod možete pripremiti novi.</p>
      ) : null}
      {["rejected", "cancelled", "superseded"].includes(status) ? (
        <p className="kk-fine">Nema daljih koraka za kancelariju u ovom stanju.</p>
      ) : null}
      {error ? (
        <p className="kk-problem" role="alert">
          {error}{" "}
          {stale ? (
            stale.currentId !== orderId ? (
              <a href={`/portal/zahtevi/${stale.currentId}`}>Otvorite aktuelnu verziju ({stale.currentNumber})</a>
            ) : (
              <button type="button" className="portal-button" data-variant="secondary" onClick={() => { setError(null); setStale(null); router.refresh(); }}>
                Prikažite aktuelno stanje
              </button>
            )
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
