"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/portal/PortalPrimitives";
import { bulkNotificationAction, type NotificationActionState } from "@/app/portal/obavestenja/actions";
import { NOTIFICATION_KIND_LABELS, NOTIFICATION_SEVERITY_TONES } from "@/lib/portal/status-labels";

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

/**
 * Obaveštenja (2026-11-24): kompaktan spisak sa čekiranjem — više obaveštenja se označava
 * pročitanim ili zatvara odjednom, sa jednom napomenom.
 */
export function NotificationList({ items, canResolve }: { items: NotificationItem[]; canResolve: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [note, setNote] = useState("Pregledano");
  const [state, setState] = useState<NotificationActionState>({ error: null, ok: null });
  const [pending, start] = useTransition();
  const open = items.filter((i) => i.status !== "resolved");

  if (items.length === 0) {
    return (
      <section className="portal-panel">
        <div className="portal-panel-body">
          <h2>Nema obaveštenja</h2>
          <p>Obaveštenja nastaju iz stvarnih događaja (predlozi i odobrenja cena, kreditni limiti, storna, zahtevi kupaca). Prazna lista znači da se ništa nije desilo.</p>
        </div>
      </section>
    );
  }

  const toggle = (id: number, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const run = (mode: "read" | "resolve", ids: number[]) =>
    start(async () => {
      const r = await bulkNotificationAction({ ids, mode, note });
      setState(r);
      if (!r.error) setSel(new Set());
      router.refresh();
    });
  const allOn = open.length > 0 && open.every((i) => sel.has(i.id));

  return (
    <section className="portal-panel nt-panel">
      <div className="nt-bar" role="region" aria-label="Grupna radnja">
        <label className="nt-all">
          <input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? new Set(open.map((i) => i.id)) : new Set())} disabled={!open.length} />
          Izaberite sve otvorene ({open.length})
        </label>
        <span className="nt-count">Izabrano: {sel.size}</span>
        <button type="button" className="portal-button" disabled={pending || !sel.size} onClick={() => run("read", [...sel])}>
          Označite pročitanim
        </button>
        {canResolve ? (
          <>
            <input className="nt-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-label="Napomena o zatvaranju" placeholder="Napomena o zatvaranju" />
            <button type="button" className="portal-button" data-variant="primary" disabled={pending || !sel.size || note.trim().length < 3} onClick={() => run("resolve", [...sel])}>
              {pending ? "Čuvam…" : `Zatvorite izabrane${sel.size ? ` (${sel.size})` : ""}`}
            </button>
          </>
        ) : null}
      </div>
      {state.error ? <p className="portal-login-error nt-msg" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="portal-permission-ok nt-msg" role="status">{state.ok}</p> : null}

      <ul className="nt-list">
        {items.map((item) => {
          const closed = item.status === "resolved";
          return (
            <li key={item.id} className="nt-item" data-status={item.status}>
              <input type="checkbox" checked={sel.has(item.id)} onChange={(e) => toggle(item.id, e.target.checked)} disabled={closed} aria-label={`Izaberite: ${item.title}`} />
              <div className="nt-main">
                <div className="nt-head">
                  <Badge tone={NOTIFICATION_SEVERITY_TONES[item.severity] ?? "info"}>{NOTIFICATION_KIND_LABELS[item.kind] ?? item.kind}</Badge>
                  {item.status === "unread" ? <span className="nt-dot" aria-label="nepročitano" /> : null}
                  <strong>{item.title}</strong>
                </div>
                <p>{item.body}</p>
                <small>
                  {item.createdAt}
                  {closed && item.resolutionNote ? ` · zatvoreno: ${item.resolutionNote}` : null}
                </small>
              </div>
              <div className="nt-actions">
                {item.actionHref ? <Link className="portal-button" href={item.actionHref}>Otvorite</Link> : null}
                {item.status === "unread" ? (
                  <button type="button" className="portal-button" data-variant="secondary" disabled={pending} onClick={() => run("read", [item.id])}>Pročitano</button>
                ) : null}
                {canResolve && !closed ? (
                  <button type="button" className="portal-button" data-variant="secondary" disabled={pending || note.trim().length < 3} onClick={() => run("resolve", [item.id])} title={`Zatvara sa napomenom „${note}“`}>Zatvorite</button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
