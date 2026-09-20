/**
 * Shopware konfigurator na sata.com — zajedničko čitanje za stranicu porodice i stranicu artikla.
 *
 * Dva zvanična podatka dolaze odavde:
 *
 *  1. `parentId` — `data-variant-switch-options` nosi `…/detail/<parentId>/switch`. Isti
 *     identifikator stoji na stranici porodice i na stranici SVAKOG njenog artikla, pa je to
 *     dokaz pripadnosti. Sama adresa se NE otvara (`robots.txt`: `Disallow: /*?`), čita se samo
 *     iz HTML-a koji je ionako preuzet.
 *  2. ose i izabrane vrednosti — `<h4>` je naziv ose, `<input … checked>` je vrednost ovog artikla.
 *     Redosled vrednosti u `og:title` nije pouzdan, pa se osa nikad ne pogađa po poziciji.
 */

const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();

export function parseConfigurator(html) {
  const parentId = /data-variant-switch-options=(?:"|')[^"']*?detail(?:\\?\/|&#x2F;)+([a-f0-9]{32})/.exec(html)?.[1]
    ?? /detail\\?\/([a-f0-9]{32})\\?\/switch/.exec(html)?.[1]
    ?? null;

  const axes = [];
  const groups = html.split(/class="product-detail-configurator-group-wrapper/).slice(1);
  for (const group of groups) {
    const name = decode(/<h4[^>]*>([\s\S]*?)<\/h4>/.exec(group)?.[1]?.replace(/<[^>]+>/g, " "));
    if (!name) continue;
    const options = [];
    for (const option of group.split(/class="product-detail-configurator-option"/).slice(1)) {
      const input = /<input[^>]*>/.exec(option)?.[0] ?? "";
      const value = decode(/<label[^>]*title="([^"]*)"/.exec(option)?.[1]);
      if (!value) continue;
      options.push({
        value,
        selected: /\schecked(?:[\s=>]|$)/.test(input),
        // `is-combinable` = kombinacija sa trenutnim izborom postoji kao artikal.
        combinable: /is-combinable/.test(input),
      });
    }
    if (options.length) axes.push({ name, options });
  }

  const selection = Object.fromEntries(
    axes.map((axis) => [axis.name, axis.options.find((option) => option.selected)?.value ?? null]),
  );
  return { parentId, axes, selection };
}
