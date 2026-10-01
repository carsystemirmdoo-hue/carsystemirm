import type { RecomputeStatus } from "@/lib/recommendations/auto-recompute";
import { AutoRecomputeRetry } from "./AutoRecomputeRetry";

const SOURCE: Record<string, string> = {
  device: "uvoz sa uređaja",
  manual_upload: "ručni uvoz PDF-a",
  customer_mapping: "knjiženje posle mapiranja kupca",
};

function when(at: Date | null) {
  return at
    ? new Date(at).toLocaleString("sr-Latn-RS", { timeZone: "Europe/Belgrade", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

/**
 * Stanje automatskog obračuna preporuka posle uvoza. Neuspeh je uvek vidljiv
 * sa razlogom i dugmetom za ponavljanje (za one koji to smeju).
 */
export function AutoRecomputeStatus({ status, canRetry }: { status: RecomputeStatus; canRetry: boolean }) {
  if (!status.enabled && !status.latest) return null;
  const l = status.latest;
  return (
    <div className="ar-status" data-state={l?.status ?? "none"} role={l?.status === "failed" ? "alert" : undefined}>
      <strong>Automatski obračun posle uvoza{status.enabled ? "" : " (isključen)"}:</strong>{" "}
      {!l ? (
        "još nije bilo uvoza."
      ) : l.status === "succeeded" ? (
        <>uspeo {when(l.finishedAt)} · {SOURCE[l.source] ?? l.source}, {l.documentCount} dok.</>
      ) : l.status === "running" ? (
        <>u toku od {when(l.requestedAt)}…</>
      ) : l.status === "pending" ? (
        <>čeka obradu ({l.documentCount} novih dok.).</>
      ) : (
        <>
          <b>nije uspeo</b> {when(l.finishedAt)} ({l.failureCode}) — {l.failureDetail} Prethodni obračun važi dalje.
          {canRetry ? <AutoRecomputeRetry requestId={l.id} /> : <> Ponoviti može kancelarija ili Vlasnik.</>}
        </>
      )}
      {status.pending && l?.status !== "pending" ? <> · novi zahtev čeka obradu</> : null}
    </div>
  );
}
