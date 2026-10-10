"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/ordering/ConfirmAction";
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
 * server svejedno proverava prelaz, sposobnost i verziju (zastarela radnja se odbija).
 * Glavna radnja desno; opasna odvojena i uvek kroz dijalog sa razlogom.
 */
export function OfficeOrderActions({
  orderId,
  status,
  canReview,
  canConfirm,
  biznisoftDocumentNumber,
  onRequestLines = 0,
  version,
  revisable = false,
}: {
  orderId: string;
  status: string;
  canReview: boolean;
  canConfirm: boolean;
  biznisoftDocumentNumber: string | null;
  onRequestLines?: number;
  /** Oznaka prikazane verzije — server odbija radnju ako se zahtev u međuvremenu promenio. */
  version: string;
  /** Ispod je obrazac za izmenjen predlog. */
  revisable?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<{ currentId: string; currentNumber: string } | null>(null);
  const [doc, setDoc] = useState("");
  const [docError, setDocError] = useState<string | null>(null);

  const run = (which: string, fn: () => Promise<Result>) =>
    new Promise<void>((resolve) =>
      start(async () => {
        setBusy(which);
        const r = await fn();
        setBusy(null);
        setError(r.ok ? null : r.message);
        setStale(!r.ok && r.stale ? r.stale : null);
        if (r.ok) router.refresh();
        resolve();
      }),
    );

  if (!canReview && !canConfirm) {
    return <p className="pn-why">Samo pregled. Prijem i potvrdu radi kancelarija.</p>;
  }

  const problem = error ? (
    <div className="pn-note" data-tone="danger" role="alert">
      <div className="pn-note-row">
        <span>{error}</span>
        {stale ? (
          stale.currentId !== orderId ? (
            <a href={`/portal/zahtevi/${stale.currentId}`} className="pn-btn" data-size="sm">
              Otvorite aktuelnu verziju ({stale.currentNumber})
            </a>
          ) : (
            <button type="button" className="pn-btn" data-size="sm" onClick={() => { setError(null); setStale(null); router.refresh(); }}>
              Prikažite aktuelno stanje
            </button>
          )
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div className="pn" style={{ gap: 10 }} data-unsaved={doc.trim() ? "true" : undefined}>
      {status === "submitted" && canReview ? (
        <div className="pn-actions">
          <button type="button" className="pn-btn" data-variant="primary" disabled={pending} aria-busy={busy === "take" || undefined} onClick={() => run("take", () => takeIntoReviewAction(orderId, version))}>
            {busy === "take" ? "Preuzima se…" : "Preuzmite u obradu"}
          </button>
        </div>
      ) : null}

      {status === "under_review" ? (
        <>
          <div className="pn-actions">
            {canReview ? (
              <>
                <ConfirmAction
                  label="Odbijte zahtev…"
                  variant="danger"
                  title="Odbijte zahtev"
                  body="Kupac vidi razlog. Odbijen zahtev ostaje u istoriji i ne može se vratiti u obradu."
                  confirmLabel="Odbijte zahtev"
                  pendingLabel="Odbija se…"
                  reason={{ label: "Razlog (vidi ga kupac)", min: 5 }}
                  pending={pending}
                  onConfirm={(reason) => run("reject", () => rejectOrderAction(orderId, reason, version))}
                />
                <span className="pn-sep" aria-hidden="true" />
                <ConfirmAction
                  label="Tražite izmenu od kupca…"
                  title="Tražite izmenu od kupca"
                  body="Kupac vraća stavke u korpu i šalje ispravku. Ako želite da sami predložite robu i količine, koristite izmenjen predlog ispod."
                  confirmLabel="Pošaljite zahtev za izmenu"
                  confirmVariant="primary"
                  reason={{ label: "Šta kupac treba da promeni (vidi ga kupac)", min: 5 }}
                  pending={pending}
                  onConfirm={(reason) => run("changes", () => requestChangesAction(orderId, reason, version))}
                />
              </>
            ) : null}
            {canConfirm ? (
              <ConfirmAction
                label="Potvrdite porudžbinu…"
                variant="primary"
                title="Potvrdite porudžbinu"
                body="Potvrda dodeljuje broj porudžbine i obavezuje prema kupcu. Porudžbinu zatim ručno unosite u BizniSoft. Potvrda nije faktura."
                confirmLabel="Potvrdite porudžbinu"
                pendingLabel="Potvrđuje se…"
                disabled={onRequestLines > 0}
                pending={pending}
                onConfirm={() => run("confirm", () => confirmOrderAction(orderId, version))}
              />
            ) : null}
          </div>
          {canConfirm && onRequestLines > 0 ? (
            <p className="pn-why" style={{ textAlign: "right" }}>
              Potvrda nije moguća dok ima stavki bez cene (na upit: {onRequestLines}). Posle odobrenja rabata u „Rabati kupca“ ponovo proverite cene u
              izmenjenom predlogu ili ga pošaljite bez tih stavki; kupac ga potvrđuje.
            </p>
          ) : null}
          {revisable ? (
            <p className="pn-why" style={{ textAlign: "right" }}>
              Promena robe ili količina: <a href="#izmena">izmenjen predlog ispod</a>.
            </p>
          ) : null}
        </>
      ) : null}

      {status === "confirmed" && canConfirm ? (
        biznisoftDocumentNumber ? (
          <p className="pn-small">
            Upisan broj dokumenta iz BizniSofta: <strong className="pn-num">{biznisoftDocumentNumber}</strong>. Isprava ide kroz BizniSoft.
          </p>
        ) : (
          <form
            className="pn-filters"
            onSubmit={(e) => {
              e.preventDefault();
              if (doc.trim().length < 2) {
                setDocError("Upišite broj dokumenta koji je BizniSoft dodelio (najmanje 2 znaka).");
                return;
              }
              setDocError(null);
              void run("doc", () => recordBiznisoftAction(orderId, doc, version));
            }}
          >
            <div className="pn-field" style={{ maxWidth: 360 }}>
              <label htmlFor={`bs-${orderId}`}>Broj dokumenta iz BizniSofta</label>
              <input id={`bs-${orderId}`} value={doc} onChange={(e) => setDoc(e.target.value)} disabled={pending} maxLength={60} aria-invalid={docError ? true : undefined} aria-describedby={docError ? `bs-${orderId}-e` : `bs-${orderId}-h`} autoComplete="off" />
              {docError ? (
                <span id={`bs-${orderId}-e`} className="pn-error">
                  {docError}
                </span>
              ) : (
                <span id={`bs-${orderId}-h`} className="pn-help">
                  Portal ne piše u BizniSoft — ovde se samo beleži broj ručnog unosa.
                </span>
              )}
            </div>
            <button type="submit" className="pn-btn" data-variant="primary" disabled={pending} aria-busy={busy === "doc" || undefined}>
              {busy === "doc" ? "Upisuje se…" : "Upišite broj"}
            </button>
          </form>
        )
      ) : null}
      {problem}
    </div>
  );
}
