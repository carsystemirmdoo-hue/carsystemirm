import { can } from "@/lib/authz/permissions.mjs";
import { getPortalUser } from "@/lib/authz/session";
import { slikaZaPrikaz } from "@/lib/saveti/urednik/servis";

/**
 * Naslovne slike članaka (WebP iz baze). Javno se služi samo slika iz javne verzije
 * nepovučenog članka; slike nacrta vidi samo vlasnik (sposobnost `view:clanci`).
 * Adresa je id slike, a sadržaj se ne menja (slike se samo dodaju), pa javna slika
 * može dugo da se kešira.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const javna = await slikaZaPrikaz(id, false);
  if (javna) {
    return new Response(new Uint8Array(javna.sadrzaj), {
      headers: {
        "Content-Type": javna.mime,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        ETag: `"${javna.sha256.slice(0, 32)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const user = await getPortalUser();
  if (!user || !can(user, "view:clanci")) return new Response("Nije pronađeno", { status: 404 });
  const nacrt = await slikaZaPrikaz(id, true);
  if (!nacrt) return new Response("Nije pronađeno", { status: 404 });
  return new Response(new Uint8Array(nacrt.sadrzaj), {
    headers: { "Content-Type": nacrt.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
