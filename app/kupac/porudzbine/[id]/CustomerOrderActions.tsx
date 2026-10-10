"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerRevisionAction, cancelOrderAction, returnOrderToCartAction } from "@/app/kupac/korpa/actions";
import { ConfirmAction } from "@/components/ordering/ConfirmAction";

type Result = { ok: boolean; message?: string; stale?: { currentId: string; currentNumber: string } };

/**
 * Kupčeve radnje nad zahtevom. Svaka šalje oznaku prikazane verzije (`version`);
 * ako se zahtev u međuvremenu promenio, server radnju odbija i nudi aktuelnu verziju.
 * Glavna radnja desno; opasna (odbijanje, otkazivanje) odvojena i uvek uz potvrdu.
 */
export function CustomerOrderActions({
  orderId,
  status,
  version,
  grossLabel = null,
  pendingProposal = null,
}: {
  orderId: string;
  status: string;
  version: string;
  /** Iznos predloga za tekst potvrde (npr. „474.432,00 RSD sa PDV-om“ ili „iznos još nije utvrđen“). */
  grossLabel?: string | null;
  /** Izmenjen predlog kancelarije za ovaj zahtev (čeka potvrdu ili je potvrđen) — tada se ovde ništa ne menja. */
  pendingProposal?: { id: string; requestNumber: string; status: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; stale?: Result["stale"] } | null>(null);

  const run = (which: string, fn: () => Promise<Result>, then?: string) =>
    new Promise<void>((resolve) =>
      start(async () => {
        setBusy(which);
        setError(null);
        const r = await fn();
        setBusy(null);
        if (!r.ok) setError({ text: r.message ?? "Radnja nije uspela.", stale: r.stale });
        else if (then) router.push(then);
        else router.refresh();
        resolve();
      }),
    );

  const problem = error ? (
    <div className="pn-note" data-tone="danger" role="alert">
      <div className="pn-note-row">
        <span>{error.text}</span>
        {error.stale ? (
          error.stale.currentId !== orderId ? (
            <a href={`/kupac/porudzbine/${error.stale.currentId}`} className="pn-btn" data-size="sm">
              Otvorite aktuelnu verziju ({error.stale.currentNumber})
            </a>
          ) : (
            <button type="button" className="pn-btn" data-size="sm" onClick={() => { setError(null); router.refresh(); }}>
              Prikažite aktuelno stanje
            </button>
          )
        ) : null}
      </div>
    </div>
  ) : null;

  if (status === "awaiting_customer") {
    return (
      <>
        <div className="pn-actions">
          <ConfirmAction
            label="Odbijte predlog…"
            variant="danger"
            title="Odbijte izmenjen predlog"
            body="Predlog prelazi u istoriju, a raniji zahtev ostaje sa statusom „Potrebna izmena“. Odbijanje ne možete poništiti; posle njega kancelarija može pripremiti nov predlog ili Vi možete poslati ispravku."
            confirmLabel="Odbijte predlog"
            pendingLabel="Odbija se…"
            pending={pending}
            onConfirm={() => run("reject", () => answerRevisionAction(orderId, false, version))}
          />
          <span className="pn-sep" aria-hidden="true" />
          <button type="button" className="pn-btn" data-variant="primary" disabled={pending} aria-busy={busy === "accept" || undefined} onClick={() => run("accept", () => answerRevisionAction(orderId, true, version))}>
            {busy === "accept" ? "Potvrđuje se…" : "Potvrdite predlog"}
          </button>
        </div>
        {grossLabel ? <p className="pn-why" style={{ textAlign: "right" }}>Potvrdom prihvatate predlog: {grossLabel}. Potvrda nije faktura ni potvrda isporuke.</p> : null}
        {problem}
      </>
    );
  }
  if (status === "changes_requested" && pendingProposal) {
    return (
      <div className="pn-actions pn-actions-start">
        <Link href={`/kupac/porudzbine/${pendingProposal.id}`} className="pn-btn" data-variant="primary">
          {pendingProposal.status === "awaiting_customer" ? `Otvorite izmenjen predlog ${pendingProposal.requestNumber}` : `Otvorite važeću verziju ${pendingProposal.requestNumber}`}
        </Link>
      </div>
    );
  }
  if (status !== "submitted" && status !== "changes_requested") return null;

  return (
    <>
      <div className="pn-actions">
        <ConfirmAction
          label="Otkažite zahtev…"
          variant="danger"
          title="Otkažite zahtev"
          body="Otkazan zahtev ostaje u istoriji, ali ga kancelarija više ne obrađuje. Otkazivanje ne možete poništiti."
          confirmLabel="Otkažite zahtev"
          pendingLabel="Otkazuje se…"
          pending={pending}
          onConfirm={() => run("cancel", () => cancelOrderAction(orderId, version))}
        />
        {status === "changes_requested" ? (
          <>
            <span className="pn-sep" aria-hidden="true" />
            <button type="button" className="pn-btn" data-variant="primary" disabled={pending} aria-busy={busy === "cart" || undefined} onClick={() => run("cart", () => returnOrderToCartAction(orderId, version), "/kupac/korpa")}>
              {busy === "cart" ? "Vraća se u korpu…" : "Vratite stavke u korpu i ispravite"}
            </button>
          </>
        ) : null}
      </div>
      {problem}
    </>
  );
}
