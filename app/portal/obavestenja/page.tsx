import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  countUnreadFor,
  listNotificationsFor,
} from "@/lib/notifications/notification-service";
import { NotificationList } from "./NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireCapability("view:obavestenja", "/portal/obavestenja");
  const canResolve = can(user, "notifications:review");

  const [items, unread] = await Promise.all([
    listNotificationsFor(user),
    countUnreadFor(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Obaveštenja"
        description="Vidite isključivo obaveštenja koja odgovaraju vašim dozvolama. Vidljivost se vezuje za sposobnost, ne za ulogu."
        meta={
          unread > 0 ? (
            <Badge tone="info">Nepročitanih: {unread}</Badge>
          ) : (
            <Badge tone="neutral">Sve pročitano</Badge>
          )
        }
      />
      <NotificationList
        items={items.map((item) => ({
          id: item.id,
          kind: item.kind,
          severity: item.severity,
          status: item.status,
          title: item.title,
          body: item.body,
          actionHref: item.actionHref,
          createdAt: new Date(item.createdAt).toLocaleString("sr-Latn-RS"),
          resolutionNote: item.resolutionNote,
        }))}
        canResolve={canResolve}
      />
    </>
  );
}
