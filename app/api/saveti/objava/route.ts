import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { uskladiDospeleObjave } from "@/lib/saveti/urednik/servis";

/**
 * Usklađivanje objava rubrike „Saveti i vodiči“ (NIJE uslov objave).
 *
 * Zakazan članak je javan od svog termina bez ovog poziva: javni upit poredi termin sa trenutkom
 * generisanja strane, a strane se obnavljaju na 60 s (lib/saveti/index.ts). Ruta samo upisuje
 * objave za termine koji su prošli (javna verzija, događaj, revizija) i odmah osvežava strane.
 * Isto usklađivanje radi i panel pri svakom otvaranju i radnji, pa zakazani posao nije potreban;
 * ako se ikad uključi (Vercel Cron, posebna odluka), poziv je bezbedan za ponavljanje.
 *
 * Zaštita: `Authorization: Bearer <CRON_SECRET>`. Bez podešene tajne ruta odbija svaki poziv.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return { ok: false as const, status: 503, razlog: "tajna zakazanog posla nije podešena" };
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false as const, status: 401, razlog: "neovlašćen poziv" };
  }
  return { ok: true as const };
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return Response.json({ ok: false, razlog: auth.razlog }, { status: auth.status, headers: { "Cache-Control": "no-store" } });
  }
  const izvestaj = await uskladiDospeleObjave(new Date());
  if (izvestaj.objavljeno.length) {
    for (const path of ["/vodici", "/vodici/novosti", "/vodici/feed", "/sitemap.xml", "/vodici/stanje.json"]) revalidatePath(path);
    revalidatePath("/vodici/[slug]", "page");
    revalidatePath("/vodici/kategorije/[slug]", "page");
    revalidatePath("/program/[slug]", "page");
    console.info(`[saveti] upisane objave: ${izvestaj.objavljeno.join(", ")}`);
  }
  return Response.json({ ok: true, ...izvestaj }, { headers: { "Cache-Control": "no-store" } });
}
