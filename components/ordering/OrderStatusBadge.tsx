import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";

const TONE: Record<string, string> = {
  submitted: "info",
  under_review: "info",
  changes_requested: "warning",
  confirmed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

/** Status zahteva/porudžbine. Isti nazivi za kupca i kancelariju. */
export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className="kk-status" data-tone={TONE[status] ?? "neutral"}>
      {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}
    </span>
  );
}
