import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSavetiRaspored, getSavetiSlotReport, savetiNow } from "@/lib/saveti";
import { daysBetween, formatZonedIso, zonedCalendarDate } from "@/lib/saveti/vreme.mjs";

/**
 * Zakazani posao rubrike „Saveti i vodiči“ (Vercel Cron, vidi vercel.json).
 *
 * Posao NE objavljuje i NE menja nijedan podatak. Objava je čista funkcija
 * stanja u repozitorijumu i vremena (lib/saveti/objava.mjs), pa se članak
 * pojavljuje i bez ovog posla — najkasnije kada istekne ISR period strane.
 * Posao samo:
 *   1. ciljano osvežava keš rubrike u terminu (spisak, novosti, kategorije,
 *      feed, sitemap i stranu članka, uključujući eventualno keširan 404);
 *   2. evidentira u logu šta je u terminima poslednja 4 dana objavljeno,
 *      preskočeno ili čeka, i zašto.
 *
 * Ponovljeno ili zakasnelo pokretanje je bezbedno: isti ulaz daje isti
 * izveštaj, a osvežavanje keša je idempotentno. Vercel ne ponavlja neuspeo
 * poziv; zato prozor obuhvata i prethodne termine.
 *
 * Zaštita: `Authorization: Bearer <CRON_SECRET>`. Bez podešene tajne ruta
 * odbija svaki poziv (fail closed).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WINDOW_DAYS = 4;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return { ok: false as const, status: 503, razlog: "CRON_SECRET nije podešen" };
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

  const now = savetiNow();
  const { podesavanja: config, termini } = getSavetiRaspored();
  const full = new URL(request.url).searchParams.get("pregled") === "sve";

  // Termini od (danas − WINDOW_DAYS) do danas, po lokalnom kalendaru.
  const today = zonedCalendarDate(now, config.vremenskaZona);
  const elapsed = daysBetween(config.pocetniDatum, today);
  const toIndex = Math.floor(elapsed / config.razmakDana);
  const fromIndex = Math.max(0, Math.ceil((elapsed - WINDOW_DAYS) / config.razmakDana));
  const lastPlanned = Math.max(-1, ...termini.map((slot) => slot.redniBroj));
  const report = full
    ? getSavetiSlotReport(now, 0, Math.max(lastPlanned, toIndex))
    : toIndex >= 0
      ? getSavetiSlotReport(now, fromIndex, toIndex).filter((row) => Date.parse(row.trenutak) <= now.getTime())
      : [];

  // Osvežavanje keša: spiskovi uvek, članci iz prozora pojedinačno.
  const paths = new Set(["/vodici", "/vodici/novosti", "/vodici/feed", "/sitemap.xml"]);
  for (const row of report) {
    if (row.slug && (row.stanje === "objavljen" || row.stanje === "povucen")) paths.add(`/vodici/${row.slug}`);
  }
  for (const path of paths) revalidatePath(path);
  revalidatePath("/vodici/kategorije/[slug]", "page");

  const summary = {
    ok: true,
    vreme: formatZonedIso(now, config.vremenskaZona),
    rasporedAktivan: config.aktivan,
    pauzaOd: config.pauzaOd,
    termini: report.map((row) => ({
      redniBroj: row.redniBroj,
      datum: row.datum,
      clanak: row.clanak,
      stanje: row.stanje,
      razlog: row.razlog,
    })),
    osvezeno: [...paths],
  };
  // Jedan red po pokretanju — čitljiv u Vercel logovima, bez tajni i ličnih podataka.
  console.info(`[saveti:objava] ${JSON.stringify({ ...summary, osvezeno: summary.osvezeno.length })}`);
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}
