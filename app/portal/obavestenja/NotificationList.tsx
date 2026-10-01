"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  markReadAction,
  resolveNotificationAction,
  type NotificationActionState,
} from "@/app/portal/obavestenja/actions";
import {
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_SEVERITY_TONES,
} from "@/lib/portal/status-labels";

const INITIAL: NotificationActionState = { error: null, ok: null };

export type NotificationItem = {
  id: number;
  kind: string;
  severity: string;
  status: string;
  title: string;
  body: string;
  actionHref: string | null;
  createdAt: string;
  resolutionNote: string | null;
};

export function NotificationList({
  items,
  canResolve,
}: {
  items: NotificationItem[];
  canResolve: boolean;
}) {
  const [readState, readAction, marking] = useActionState(markReadAction, INITIAL);
  const [resolveState, resolveAction, resolving] = useActionState(
    resolveNotificationAction,
    INITIAL,
  );
  const [openId, setOpenId] = useState<number | null>(null);

  const error = resolveState.error ?? readState.error;
  const ok = resolveState.ok ?? readState.ok;

  if (items.length === 0) {
    return (
      <section className="portal-panel">
        <h2>Nema obaveštenja</h2>
        <p>
          Obaveštenja nastaju iz stvarnih događaja — predloga cene, odobrenja,
          konflikta pravila i neuspelog usaglašavanja sa BizniSoftom. Prazna
          lista znači da se nijedan od njih nije desio.
        </p>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      {error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Radnja nije izvršena</strong>
            <small>{error}</small>
          </span>
        </div>
      ) : null}
      {ok ? (
        <p className="portal-login-hint" role="status">
          {ok}
        </p>
      ) : null}

      <ul className="portal-notification-list">
        {items.map((item) => (
          <li key={item.id} data-status={item.status}>
            <div>
              <Badge tone={NOTIFICATION_SEVERITY_TONES[item.severity] ?? "info"}>
                {NOTIFICATION_KIND_LABELS[item.kind] ?? item.kind}
              </Badge>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>
                {item.createdAt}
                {item.status === "resolved" && item.resolutionNote
                  ? ` · zatvoreno: ${item.resolutionNote}`
                  : null}
              </small>
              {item.actionHref ? (
                <p>
                  <Link href={item.actionHref}>Otvorite ekran radnje</Link>
                </p>
              ) : null}
            </div>
            <div>
              {item.status === "unread" ? (
                <form action={readAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <PortalButton type="submit" variant="ghost" disabled={marking}>
                    Označite pročitanim
                  </PortalButton>
                </form>
              ) : null}
              {canResolve && item.status !== "resolved" ? (
                <PortalButton
                  variant="ghost"
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                >
                  {openId === item.id ? "Odustanite" : "Zatvorite"}
                </PortalButton>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canResolve && openId !== null ? (
        <form action={resolveAction} className="portal-form">
          <input type="hidden" name="id" value={openId} />
          <Field
            label="Napomena o zatvaranju"
            required
            hint="Obavezna. Zatvoreno obaveštenje bez objašnjenja je izgubljena informacija."
          >
            <input type="text" name="note" minLength={3} maxLength={500} required />
          </Field>
          <PortalButton type="submit" variant="primary" disabled={resolving}>
            {resolving ? "Čuvanje…" : "Zatvorite obaveštenje"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}
