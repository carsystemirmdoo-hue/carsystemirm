import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { loadCurrentVp } from "@/lib/pricing/vp-draft-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { VpDraftEditor } from "../VpDraftEditor";

export const metadata = { title: "Nova priprema VP cenovnika" };
export const dynamic = "force-dynamic";

export default async function NewVpDraftPage() {
  await requireCapability("pricelist:prepare", "/portal/vp-cenovnik/nova");
  const today = belgradeDate(new Date());
  const rows = await loadCurrentVp(today);
  return (
    <>
      <PageHeader
        eyebrow="VP cenovnik"
        title="Nova priprema"
        description="Upišite promenu u procentima za ceo brend, grupu ili artikal, ili tačnu novu cenu artikla. Ništa se ne menja dok kancelarija ne proveri i vlasnik ne potvrdi."
        meta={<Link href="/portal/vp-cenovnik">← VP cenovnik</Link>}
      />
      <VpDraftEditor rows={rows} today={today} initial={{ id: null, title: "", proposedValidFrom: null, note: "", edits: { brands: {}, groups: {}, articles: {}, prices: {} }, rounding: "para" }} />
    </>
  );
}
