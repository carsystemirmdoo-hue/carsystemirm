"use client";

import { useState, useTransition } from "react";
import { quickAssignAction } from "./actions";

/** Padajući meni u redu kupca: izbor komercijaliste odmah dodeljuje kupca; red ostaje do osvežavanja. */
export function QuickAssign({ customerId, reps }: { customerId: string; reps: { id: string; name: string }[] }) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <span className="qa-done">✓ {done}</span>;
  return (
    <span className="qa-cell">
      <select
        value={value}
        disabled={pending}
        aria-label="Dodelite komercijalistu"
        onChange={(e) => {
          const id = e.target.value;
          setValue(id);
          if (!id) return;
          start(async () => {
            const r = await quickAssignAction(customerId, id);
            if (r.ok) setDone(reps.find((x) => x.id === id)?.name ?? "dodeljeno");
            else {
              setError(r.message);
              setValue("");
            }
          });
        }}
      >
        <option value="">{pending ? "Dodeljujem…" : "Dodelite…"}</option>
        {reps.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      {error ? <small className="portal-error" role="alert">{error}</small> : null}
    </span>
  );
}
