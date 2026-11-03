import { getPublicSaveti } from "@/lib/saveti";

/**
 * Javno stanje biblioteke „Saveti i vodiči“: samo broj objavljenih članaka i koliko je od njih
 * „rešavanje problema“ (meni „Saveti i podrška“ prikazuje grupu biblioteke tek kada postoji
 * objavljen članak, a vezu „Problemi i rešenja“ tek uz objavljen tekst te vrste). Ne otkriva
 * nacrte, termine ni naslove. Obnavlja se na 60 s, kao i strane rubrike.
 */
export const revalidate = 60;

export async function GET() {
  const javni = await getPublicSaveti();
  const problemi = javni.filter((clanak) => clanak.tip === "resavanje-problema").length;
  return Response.json({ objavljeno: javni.length, problemi }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" } });
}
