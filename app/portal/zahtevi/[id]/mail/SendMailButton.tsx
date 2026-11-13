"use client";

import { useState, useTransition } from "react";
import { sendOrderEmailAction } from "./actions";

export function SendMailButton({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mail-send">
      <button
        type="button"
        className="portal-button"
        data-variant="primary"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            setMsg(await sendOrderEmailAction(orderId));
          })
        }
      >
        {pending ? "Šaljem…" : "Pošalji mejl sada"}
      </button>
      {msg ? (
        <span className={msg.ok ? "portal-form-ok" : "portal-login-error"} role="status">
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
