import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { savetiClanci, savetiSlike, savetiVerzije } from "@/db/schema";
import { SavetiClanakPrikaz } from "@/components/saveti/SavetiClanakPrikaz";
import { requireCapability } from "@/lib/authz/session";
import { getPublicSaveti, verzijaUClanak } from "@/lib/saveti";

/**
 * Pregled verzije članka u stvarnom izgledu sajta — samo za vlasnika (provera na serveru,
 * isto kao panel). Nije javan, ne kešira se i ne indeksira se; strukturirani podaci se ne
 * ispisuju. Neprijavljen posetilac ide na prijavu, a prijavljen bez sposobnosti dobija 403.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pregled članka",
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ verzija: string }> };

export default async function PregledClanka({ params }: Props) {
  const { verzija: verzijaId } = await params;
  await requireCapability("view:clanci", `/vodici/pregled/${verzijaId}`);
  if (!/^[0-9a-f-]{36}$/.test(verzijaId)) notFound();
  const db = getDb();
  const [row] = await db
    .select({ verzija: savetiVerzije, clanak: savetiClanci })
    .from(savetiVerzije)
    .innerJoin(savetiClanci, eq(savetiClanci.id, savetiVerzije.clanakId))
    .where(eq(savetiVerzije.id, verzijaId));
  if (!row) notFound();
  let slika = null;
  if (row.verzija.slikaId) {
    const [s] = await db.select({ sirina: savetiSlike.sirina, visina: savetiSlike.visina }).from(savetiSlike).where(eq(savetiSlike.id, row.verzija.slikaId));
    if (s) slika = { id: row.verzija.slikaId, alt: row.verzija.slikaAlt, ...s };
  }
  const javna = row.clanak.javnaVerzijaId === row.verzija.id && !row.clanak.povuceno;
  const clanak = verzijaUClanak(row.clanak, row.verzija, slika);
  return (
    <SavetiClanakPrikaz
      clanak={clanak}
      published={await getPublicSaveti()}
      pregled={{
        neobjavljen: !javna && !row.clanak.prviPutObjavljeno,
        oznaka: javna ? `Pregled — verzija ${row.verzija.broj} (javna).` : `Pregled — verzija ${row.verzija.broj}, nije objavljena.`,
        opis: javna
          ? "Ovako članak trenutno izgleda na sajtu."
          : "Pregled je dostupan samo vlasniku. Status, odobrenje i zakazivanje su u panelu „Članci“.",
      }}
    />
  );
}
