"use client";

import { useState, useTransition } from "react";
import { approveRebateGroupAction } from "./actions";

export function GroupApproveButton({
  customerId,
  groupKey,
  expected,
  label,
}: {
  customerId: string;
  groupKey: string;
  expected: { articleId: string; percent: number }[];
  label: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <small className="rb-ok">{msg.message}</small>;
  return (
    <span className="rb-propose">
      <button
        type="button"
        className="portal-button"
        data-variant="secondary"
        disabled={pending}
        onClick={() => start(async () => setMsg(await approveRebateGroupAction(customerId, groupKey, expected)))}
      >
        {pending ? "Upisujem…" : label}
      </button>
      {msg && !msg.ok ? <small className="kk-problem">{msg.message}</small> : null}
    </span>
  );
}
