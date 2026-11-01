import { can } from "@/lib/authz/permissions.mjs";
import { getPortalUser } from "@/lib/authz/session";
import { slikaZaPrikaz } from "@/lib/saveti/urednik/servis";

/**
 * Naslovne slike članaka (WebP iz baze). Javno se služi samo slika iz javne verzije
 * nepovučenog članka; slike nacrta vidi samo vlasnik (sposobnost `view:clanci`).
 * Sadržaj pod jednim id-jem se ne menja, ali slika prestaje da bude javna povlačenjem
 * članka. Zato pregledač čuva sliku najviše 60 s (kao i strane rubrike), a posle toga
 * je proverava ETag-om (304 bez ponovnog slanja). Odbijen zahtev se ne kešira.
 */
const NIJE_PRONADJENO = () =>
  new Response("Nije pronađeno", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const javna = await slikaZaPrikaz(id, false);
  if (javna) {
    const etag = `"${javna.sha256.slice(0, 32)}"`;
    const headers = {
      "Cache-Control": "public, max-age=60, must-revalidate",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(javna.sadrzaj), { headers: { ...headers, "Content-Type": javna.mime } });
  }
  const user = await getPortalUser();
  if (!user || !can(user, "view:clanci")) return NIJE_PRONADJENO();
  const nacrt = await slikaZaPrikaz(id, true);
  if (!nacrt) return NIJE_PRONADJENO();
  return new Response(new Uint8Array(nacrt.sadrzaj), {
    headers: { "Content-Type": nacrt.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
