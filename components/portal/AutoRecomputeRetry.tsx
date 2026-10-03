"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryAutoRecomputeAction } from "@/app/portal/importi/recompute-actions";

export function AutoRecomputeRetry({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      {" "}
      <button
        type="button"
        className="portal-button"
        data-variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retryAutoRecomputeAction(requestId);
            setMsg(r.message);
            router.refresh();
          })
        }
      >
        {pending ? "Računam…" : "Ponovi obračun"}
      </button>
      {msg ? <small> {msg}</small> : null}
    </>
  );
}
