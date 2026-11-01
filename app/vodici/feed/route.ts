import { getPublicSaveti } from "@/lib/saveti";
import { absoluteUrl, siteConfig } from "@/lib/seo";

/**
 * RSS 2.0 spisak objavljenih tekstova.
 *
 * Adresa je namerno bez nastavka `.xml`: middleware propušta `*.xml` mimo
 * režima održavanja, a feed mora da poštuje ista pravila kao strane rubrike.
 * Sadrži samo članke koje kapija u trenutku generisanja smatra javnim.
 */
export const revalidate = 60; // = SAVETI_REVALIDATE_SECONDS (Next traži doslovnu vrednost)

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const items = (await getPublicSaveti()).slice(0, 50);
  const channelUrl = absoluteUrl("/vodici");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(`Saveti i vodiči — ${siteConfig.name}`)}</title>
<link>${channelUrl}</link>
<atom:link href="${absoluteUrl("/vodici/feed")}" rel="self" type="application/rss+xml"/>
<description>${escapeXml("Stručni vodiči i proverene novosti proizvođača iz programa Carsystem i R-M.")}</description>
<language>sr-Latn</language>
${items
  .map((clanak) => {
    const url = absoluteUrl(`/vodici/${clanak.slug}`);
    return `<item>
<title>${escapeXml(clanak.naslov)}</title>
<link>${url}</link>
<guid isPermaLink="true">${url}</guid>
<pubDate>${new Date(clanak.datumObjave).toUTCString()}</pubDate>
<description>${escapeXml(clanak.opis)}</description>
</item>`;
  })
  .join("\n")}
</channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
