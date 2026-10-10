"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerRevisionAction, cancelOrderAction, returnOrderToCartAction } from "@/app/kupac/korpa/actions";

/** Kupac sme da otkaže zahtev dok ga kancelarija nije uzela u obradu, ili kad traži izmenu. */
export function CustomerOrderActions({
  orderId,
  status,
  pendingProposal = null,
}: {
  orderId: string;
  status: string;
  /** Izmenjen predlog kancelarije za ovaj zahtev (čeka potvrdu ili je potvrđen) — tada se ovde ništa ne menja. */
  pendingProposal?: { id: string; requestNumber: string; status: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status === "awaiting_customer") {
    return (
      <div className="portal-panel-body kk-actions">
        <p>Kancelarija je pripremila izmenjen predlog (roba, količine ili cene). Original ostaje sačuvan. Pregledajte stavke i potvrdite ili odbijte.</p>
        <button type="button" className="portal-button" disabled={pending}
          onClick={() => start(async () => { const r = await answerRevisionAction(orderId, true); if (!r.ok) setError(r.message); else router.refresh(); })}>
          Potvrdite izmenjen zahtev
        </button>
        <button type="button" className="portal-button" data-variant="secondary" disabled={pending}
          onClick={() => start(async () => { const r = await answerRevisionAction(orderId, false); if (!r.ok) setError(r.message); else router.refresh(); })}>
          Odbijte predlog
        </button>
        {error ? <p className="kk-problem" role="alert">{error}</p> : null}
      </div>
    );
  }
  if (status === "changes_requested" && pendingProposal) {
    return (
      <div className="portal-panel-body kk-actions">
        <p>
          {pendingProposal.status === "awaiting_customer"
            ? "Kancelarija je pripremila izmenjen predlog. Potvrdite ga ili odbijte na predlogu:"
            : "Zahtev je zamenjen novom verzijom:"}{" "}
          <Link href={`/kupac/porudzbine/${pendingProposal.id}`}>{pendingProposal.requestNumber}</Link>
        </p>
      </div>
    );
  }
  if (status !== "submitted" && status !== "changes_requested") return null;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, then?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Nije uspelo.");
      else if (then) router.push(then);
      else router.refresh();
    });

  return (
    <div className="portal-panel-body kk-actions">
      {status === "changes_requested" ? (
        <button
          type="button"
          className="portal-button"
          disabled={pending}
          onClick={() => run(() => returnOrderToCartAction(orderId), "/kupac/korpa")}
        >
          Vratite stavke u korpu i ispravite
        </button>
      ) : null}
      <button
        type="button"
        className="portal-button"
        data-variant="secondary"
        disabled={pending}
        onClick={() => {
          if (confirm("Otkazati ovaj zahtev?")) run(() => cancelOrderAction(orderId));
        }}
      >
        Otkažite zahtev
      </button>
      {error ? <p className="kk-problem" role="alert">{error}</p> : null}
    </div>
  );
}
