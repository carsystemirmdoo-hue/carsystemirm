"use client";

import type { FormEvent } from "react";
import { beginSiteAccessHandoff } from "@/lib/site-access-handoff";

export function SiteAccessForm({
  canUnlock,
  message,
}: {
  canUnlock: boolean;
  message: { tone: string; text: string };
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const accessCode = String(formData.get("accessCode") ?? "").trim();
    if (!accessCode) return;

    beginSiteAccessHandoff();
  }

  return (
    <form
      action="/site-u-pripremi/access"
      className="access-panel reveal reveal-5"
      method="post"
      onSubmit={handleSubmit}
    >
      <label className="access-label" htmlFor="site-access-code">
        Interni pristup
      </label>
      <div className="access-row">
        <input
          autoComplete="current-password"
          className="access-input"
          disabled={!canUnlock}
          id="site-access-code"
          name="accessCode"
          placeholder="Pristupni kod"
          type="password"
        />
        <button className="access-button" disabled={!canUnlock} type="submit">
          Otključaj sajt
        </button>
      </div>
      <p className="access-message" data-tone={message.tone}>
        {message.text}
      </p>
    </form>
  );
}
