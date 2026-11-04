import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron/cronAuth.mjs";
import { purgeOldNotices } from "@/lib/pricing/customer-rebate-service";

/**
 * Dnevno fizičko brisanje internih obaveštenja o rabatima starijih od 10 dana (0057).
 * Pokreće ga Vercel Cron (`vercel.json` → `crons`) sa `Authorization: Bearer $CRON_SECRET`.
 * Pravila cena se ne diraju (tabela obaveštenja nema vezu ka `price_rules`). Isto brisanje se radi i pri
 * svakom čitanju/čuvanju, a lista ionako prikazuje samo obaveštenja mlađa od 10 dana.
 */
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "nije_podeseno") return NextResponse.json({ ok: false, error: "zakazani zadatak nije podešen" }, { status: 503, headers: NO_STORE });
  if (auth !== "ok") return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  const deleted = await purgeOldNotices();
  return NextResponse.json({ ok: true, deleted }, { headers: NO_STORE });
}
