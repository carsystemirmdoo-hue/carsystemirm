import { PageHeader, PortalLinkButton } from "@/components/portal/PortalPrimitives";
import { ClanakUrednik } from "@/features/portal/clanci/ClanakUrednik";
import { requireCapability } from "@/lib/authz/session";
import { SAVETI_KATEGORIJE } from "@/lib/saveti/kategorije.mjs";
import { TIP_LABEL } from "@/lib/saveti/urednik/servis";

export const metadata = { title: "Novi članak" };
export const dynamic = "force-dynamic";

export default async function NoviClanakPage() {
  await requireCapability("articles:edit", "/portal/clanci/novi");
  const kategorije = (SAVETI_KATEGORIJE as { slug: string; naziv: string }[]).filter((k) => k.slug !== "novosti");
  return (
    <>
      <PageHeader
        eyebrow="Sadržaj · Članci"
        title="Novi članak"
        description="Nacrt se čuva u panelu i nije javan. Na sajt izlazi tek posle pregleda, odobrenja i zakazivanja."
        actions={<PortalLinkButton href="/portal/clanci" variant="ghost">Svi članci</PortalLinkButton>}
      />
      <ClanakUrednik
        pocetno={{
          id: null,
          osnova: 0,
          slug: null,
          tip: "osnovni-vodic",
          kategorija: kategorije[0]?.slug ?? "",
          naslov: "",
          metaNaslov: "",
          opis: "",
          telo: "",
          izvori: [],
          interneNapomene: "",
          nepotvrdjeno: "",
          slika: null,
        }}
        kategorije={kategorije}
        tipovi={Object.entries(TIP_LABEL)}
        smeUredjivanje
        javno={false}
      />
    </>
  );
}
