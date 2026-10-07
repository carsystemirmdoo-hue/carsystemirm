"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelOrderAction, returnOrderToCartAction } from "@/app/kupac/korpa/actions";

/** Kupac sme da otkaže zahtev dok ga kancelarija nije uzela u obradu, ili kad traži izmenu. */
export function CustomerOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
        Otkaži zahtev
      </button>
      {error ? <p className="kk-problem" role="alert">{error}</p> : null}
    </div>
  );
}
