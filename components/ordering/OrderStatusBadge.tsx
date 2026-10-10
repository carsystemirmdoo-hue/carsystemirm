import { orderStage } from "@/lib/ordering/statusView.mjs";

type Audience = "customer" | "office";
type Ctx = { audience?: Audience; biznisoftRecorded?: boolean; pendingProposal?: boolean; oldVersion?: boolean };

/** Status zahteva/porudžbine: tekst + oblik oznake (ne samo boja). Isti nazivi za kupca i kancelariju. */
export function OrderStatusBadge({ status, ...ctx }: { status: string } & Ctx) {
  const v = orderStage(status, { audience: ctx.audience ?? "customer", ...ctx, oldVersion: false });
  return (
    <span className="pn-status" data-tone={v.tone}>
      {v.label}
    </span>
  );
}

/** Status + „Na potezu: …“ u jednom redu (zaglavlje detalja, liste). */
export function OrderStage({ status, oldVersion = false, ...ctx }: { status: string } & Ctx) {
  const v = orderStage(status, { audience: ctx.audience ?? "customer", ...ctx, oldVersion });
  return (
    <span className="pn-inline">
      <span className="pn-status" data-tone={v.tone}>
        {v.label}
      </span>
      <span className="pn-turn" data-turn={v.turn}>
        {v.turnText}
      </span>
    </span>
  );
}
