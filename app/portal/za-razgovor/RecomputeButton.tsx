"use client";

import { useActionState } from "react";
import { PortalButton } from "@/components/portal/PortalPrimitives";
import { recomputeTodayAction } from "./actions";

export function RecomputeButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState(recomputeTodayAction, { error: null, ok: null });
  return (
    <form action={action} className="portal-inline-form">
      <PortalButton type="submit" variant="secondary" disabled={pending}>
        {pending ? "Preračunavanje…" : label}
      </PortalButton>
      {state.error ? <small data-tone="danger">{state.error}</small> : null}
      {state.ok ? <small data-tone="success">{state.ok}</small> : null}
    </form>
  );
}
