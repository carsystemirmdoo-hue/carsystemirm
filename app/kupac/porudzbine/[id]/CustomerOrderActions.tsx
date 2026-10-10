"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerRevisionAction, cancelOrderAction, returnOrderToCartAction } from "@/app/kupac/korpa/actions";

type Result = { ok: boolean; message?: string; stale?: { currentId: string; currentNumber: string } };

/**
 * Kupčeve radnje nad zahtevom. Svaka šalje oznaku prikazane verzije (`version`);
 * ako se zahtev u međuvremenu promenio, server radnju odbija i nudi aktuelnu verziju.
 */
export function CustomerOrderActions({
  orderId,
  status,
  version,
  pendingProposal = null,
}: {
  orderId: string;
  status: string;
  version: string;
  /** Izmenjen predlog kancelarije za ovaj zahtev (čeka potvrdu ili je potvrđen) — tada se ovde ništa ne menja. */
  pendingProposal?: { id: string; requestNumber: string; status: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; stale?: Result["stale"] } | null>(null);

  const run = (fn: () => Promise<Result>, then?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError({ text: r.message ?? "Nije uspelo.", stale: r.stale });
      else if (then) router.push(then);
      else router.refresh();
    });

  const problem = error ? (
    <p className="kk-problem" role="alert">
      {error.text}{" "}
      {error.stale ? (
        error.stale.currentId !== orderId ? (
          <a href={`/kupac/porudzbine/${error.stale.currentId}`}>Otvorite aktuelnu verziju ({error.stale.currentNumber})</a>
        ) : (
          <button type="button" className="portal-button" data-variant="secondary" onClick={() => { setError(null); router.refresh(); }}>
            Prikažite aktuelno stanje
          </button>
        )
      ) : null}
    </p>
  ) : null;

  if (status === "awaiting_customer") {
    return (
      <div className="portal-panel-body kk-actions">
        <p>Kancelarija je pripremila izmenjen predlog (roba, količine ili cene). Original ostaje sačuvan. Pregledajte stavke i potvrdite ili odbijte.</p>
        <button type="button" className="portal-button" disabled={pending} onClick={() => run(() => answerRevisionAction(orderId, true, version))}>
          Potvrdite izmenjen zahtev
        </button>
        <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => run(() => answerRevisionAction(orderId, false, version))}>
          Odbijte predlog
        </button>
        {problem}
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

  return (
    <div className="portal-panel-body kk-actions">
      {status === "changes_requested" ? (
        <button type="button" className="portal-button" disabled={pending} onClick={() => run(() => returnOrderToCartAction(orderId, version), "/kupac/korpa")}>
          Vratite stavke u korpu i ispravite
        </button>
      ) : null}
      <button
        type="button"
        className="portal-button"
        data-variant="secondary"
        disabled={pending}
        onClick={() => {
          if (confirm("Otkazati ovaj zahtev?")) run(() => cancelOrderAction(orderId, version));
        }}
      >
        Otkažite zahtev
      </button>
      {problem}
    </div>
  );
}
