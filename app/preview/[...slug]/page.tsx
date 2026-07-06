import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  isEnabled,
  isValidSiteAccessToken,
  SITE_ACCESS_COOKIE_NAME,
} from "@/lib/site-access";

export default async function PreviewCatchAllRedirectPage() {
  const maintenanceEnabled = isEnabled(process.env.MAINTENANCE_MODE);
  const cookieStore = await cookies();
  const hasAccess = await isValidSiteAccessToken(
    cookieStore.get(SITE_ACCESS_COOKIE_NAME)?.value,
  );

  redirect(maintenanceEnabled && !hasAccess ? "/site-u-pripremi" : "/");
}
