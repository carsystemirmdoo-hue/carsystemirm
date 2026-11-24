"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalIcon } from "./PortalIcon";

const REFRESH_MS = 60_000;

/** Događaj koji lista obaveštenja šalje posle „Označite pročitanim“ ili zatvaranja. */
export const NOTIFICATIONS_CHANGED = "cs-notifications-changed";

/**
 * Zvonce sa brojem nepročitanih.
 *
 * Broj se čita sa servera, a ne iz layouta: layout se pri prelasku sa strane
 * na stranu ne iscrtava ponovo, pa bi broj ostao zastareo posle „Označite
 * pročitanim“. Osvežava se pri svakoj promeni strane, pri povratku u prozor i
 * na minut. Bez dozvole za obaveštenja (403) ili bez mreže zvonce ostaje bez broja.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/portal/obavestenja/broj", { cache: "no-store" });
        if (!r.ok) return;
        const body = (await r.json()) as { unread?: number };
        if (alive) setUnread(typeof body.unread === "number" ? body.unread : 0);
      } catch {
        // Bez broja je bolje nego pogrešan broj.
      }
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED, onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onFocus);
    };
  }, [pathname]);

  const label = unread > 0 ? `Obaveštenja — nepročitanih: ${unread}` : "Obaveštenja";
  return (
    <Link href="/portal/obavestenja" className="portal-icon-button" aria-label={label} title={label}>
      <PortalIcon name="bell" />
      {unread > 0 ? (
        <span className="portal-bell-count" aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
