"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { setDefaultPercentAction, setLimitAction } from "./actions";

/** „Podesi“ u redu kupca: podrazumevani limit, sopstveni procenat ili tačan iznos + blokada. */
export function LimitEditor({
  customerId,
  customerName,
  current,
  defaultPercent,
  open: openInitially,
}: {
  customerId: string;
  customerName: string;
  current: { percent: number | null; amount: number | null; blockOrders: boolean; note: string } | null;
  defaultPercent: number;
  open?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(openInitially));
  const [mode, setMode] = useState<"default" | "percent" | "amount">(current?.amount !== null && current?.amount !== undefined ? "amount" : current?.percent !== null && current?.percent !== undefined ? "percent" : "default");
  const [value, setValue] = useState(current?.amount ?? current?.percent ?? "");
  const [block, setBlock] = useState(current?.blockOrders ?? false);
  const [note, setNote] = useState(current?.note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="lm-btn" onClick={() => setOpen(true)}>
        Podesi
      </button>
    );
  }
  const save = () =>
    start(async () => {
      const r = await setLimitAction({ customerId, mode, value: String(value), blockOrders: block, note });
      setMsg(r);
      if (r?.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  return (
    <div className="lm-editor" role="dialog" aria-label={`Limit: ${customerName}`}>
      <p className="lm-editor-title">Limit: {customerName}</p>
      <div className="lm-modes">
        <label><input type="radio" name={`m-${customerId}`} checked={mode === "default"} onChange={() => setMode("default")} /> Podrazumevano ({defaultPercent} %)</label>
        <label><input type="radio" name={`m-${customerId}`} checked={mode === "percent"} onChange={() => setMode("percent")} /> Procenat</label>
        <label><input type="radio" name={`m-${customerId}`} checked={mode === "amount"} onChange={() => setMode("amount")} /> Tačan iznos</label>
      </div>
      {mode !== "default" ? (
        <label className="lm-value">
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "percent" ? "npr. 200" : "npr. 300.000"} aria-label={mode === "percent" ? "Procenat" : "Iznos u RSD"} />
          <span>{mode === "percent" ? "% mesečne kupovine" : "RSD"}</span>
        </label>
      ) : null}
      <label className="lm-check"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Blokiraj porudžbine preko portala kada je dug preko limita</label>
      <label className="lm-note">
        <span>Obrazloženje{mode === "default" ? " (nije obavezno)" : ""}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="npr. dogovoren rok 60 dana" />
      </label>
      <div className="lm-actions">
        <button type="button" className="lm-btn lm-btn-primary" onClick={save} disabled={pending}>{pending ? "Čuvam…" : "Sačuvaj"}</button>
        <button type="button" className="lm-btn" onClick={() => { setOpen(false); setMsg(null); }} disabled={pending}>Odustani</button>
        {msg && !msg.ok ? <span className="lm-err" role="alert">{msg.text}</span> : null}
      </div>
    </div>
  );
}

export function DefaultPercentForm({ value }: { value: number }) {
  const [state, action, pending] = useActionState(setDefaultPercentAction, null);
  return (
    <form action={action} className="lm-default">
      <label>
        <span>Podrazumevani limit</span>
        <span className="lm-value">
          <input name="procenat" inputMode="decimal" defaultValue={String(value)} aria-label="Podrazumevani procenat" />
          <span>% prosečne mesečne kupovine</span>
        </span>
      </label>
      <button type="submit" className="lm-btn" disabled={pending}>{pending ? "Čuvam…" : "Sačuvaj"}</button>
      {state ? <span className={state.ok ? "lm-ok" : "lm-err"} role="status">{state.text}</span> : null}
    </form>
  );
}
