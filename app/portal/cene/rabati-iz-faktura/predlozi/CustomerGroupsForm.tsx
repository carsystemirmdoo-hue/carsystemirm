"use client";

import { useState, useTransition } from "react";
import { approveRebateGroupsAction } from "./actions";
import { countOf, ARTIKAL, GRUPA } from "@/lib/ordering/plural.mjs";

type Group = { key: string; label: string; percent: number | null; expected: { articleId: string; percent: number }[]; preselect: boolean };

/** Više jasnih grupa kupca odjednom; izuzeci (pojedinačni artikli) nisu unapred izabrani. */
export function CustomerGroupsForm({ customerId, groups, verb }: { customerId: string; groups: Group[]; verb: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set(groups.filter((g) => g.preselect).map((g) => g.key)));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <p className="rb-ok">{msg.message}</p>;
  const chosen = groups.filter((g) => sel.has(g.key));
  const n = chosen.reduce((s, g) => s + g.expected.length, 0);
  return (
    <div className="rc-all">
      <fieldset className="rc-modes">
        <legend>Potvrda više grupa odjednom</legend>
        {groups.map((g) => (
          <label key={g.key}>
            <input
              type="checkbox"
              checked={sel.has(g.key)}
              onChange={(e) => {
                const s = new Set(sel);
                if (e.target.checked) s.add(g.key);
                else s.delete(g.key);
                setSel(s);
              }}
            />{" "}
            {g.label} ({g.expected.length})
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className="portal-button"
        disabled={pending || !chosen.length}
        onClick={() => start(async () => setMsg(await approveRebateGroupsAction(customerId, chosen.map((g) => ({ groupKey: g.key, expected: g.expected })))))}
      >
        {pending ? "Upisujem…" : `${verb} izabrane grupe (${countOf(chosen.length, GRUPA)}, ${countOf(n, ARTIKAL)})`}
      </button>
      {msg && !msg.ok ? <small className="kk-problem">{msg.message}</small> : null}
    </div>
  );
}
