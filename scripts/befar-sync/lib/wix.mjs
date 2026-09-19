/**
 * Čitanje Wix stranice kategorije sa befar.com.tr.
 *
 * Wix ne renderuje tabelu kao <table>: svaka ćelija je zaseban `WRichText`
 * element, apsolutno postavljen u mesh mreži svog roditelja. Redosled u HTML-u
 * je nekad po kolonama, nekad po redovima, pa se NE koristi. Položaj se čita iz
 * CSS pravila koje Wix ispisuje za svaki element:
 *
 *   [data-mesh-id=<roditelj>inlineContent-gridContainer] > [id="<element>"]
 *     { …; left:712px; grid-area:5 / 1 / 6 / 2; … }
 *
 * `grid-area` daje red, `left` x-poziciju. Ugnježđene grupe (`Group`) nose
 * sopstvenu mrežu, pa je apsolutni x zbir `left` vrednosti do sekcije, a ključ
 * reda je putanja redova od sekcije do ćelije.
 *
 * Blok proizvoda = `ClassicSection` (ili `Group`/kolona koja sama nosi tabelu).
 */

const ENTITIES = {
  "&amp;": "&", "&nbsp;": " ", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&#39;": "'", "&#x27;": "'", "&apos;": "'",
  // Turska slova koja Wix ispisuje kao imenovane entitete.
  "&uuml;": "ü", "&Uuml;": "Ü", "&ouml;": "ö", "&Ouml;": "Ö", "&ccedil;": "ç", "&Ccedil;": "Ç", "&rsquo;": "’", "&ndash;": "–", "&sup2;": "²", "&deg;": "°",
};

export function decode(value) {
  let text = String(value ?? "");
  for (const [entity, replacement] of Object.entries(ENTITIES)) text = text.split(entity).join(replacement);
  return text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export const clean = (value) => decode(String(value ?? "").replace(/<[^>]*>/g, " ")).replace(/[\s ​]+/g, " ").trim();

/** Zvanična Befar šifra: 5–6 cifara, opciono slovni sufiks (56401ORB, 08401SND, 80012O). „1000” je mera, ne šifra. */
export const CODE = /^\d{5,6}[A-Z]{0,4}$/;

const HEADER_VOCABULARY = [
  { key: "product", re: /^(products?|ürün|ürün adı|ürünler)$/i },
  { key: "code", re: /^(code?|cod|kod|ürün kodu)$/i },
  { key: "size", re: /^(size|sizes|measurement|ölçü|ölçüler|ebat|boyut)$/i },
  { key: "colour", re: /^(colou?r|renk)$/i },
  { key: "holes", re: /^(holes?|delik)$/i },
  { key: "hardness", re: /^(hardness|sertlik)$/i },
  { key: "quantity", re: /^(quantity|qty|adet|pcs\.?)$/i },
];
const headerKey = (text) => HEADER_VOCABULARY.find((entry) => entry.re.test(text))?.key ?? null;

/** Medijski ID iz Wix URL-a: `…/media/446a5e_abc~mv2.jpg/v1/fill/…` → `446a5e_abc~mv2.jpg`. */
export function mediaId(url) {
  return /\/media\/([^/?"']+)/.exec(url ?? "")?.[1] ?? null;
}

export function parseWixPage(html) {
  const types = Object.fromEntries([...html.matchAll(/"(comp-[\w]+)":"([A-Za-z]+)"/g)].map((match) => [match[1], match[2]]));

  /** element → { parent, row, left } */
  const placement = new Map();
  for (const match of html.matchAll(/\[data-mesh-id=([\w-]+?)inlineContent-gridContainer\] > \[id="([\w-]+)"\][^{]*\{([^}]*)\}/g)) {
    const [, parent, id, css] = match;
    if (placement.has(id)) continue;
    placement.set(id, {
      parent,
      row: Number(/grid-area:(\d+)/.exec(css)?.[1] ?? 0),
      left: Number(/left:(-?[\d.]+)px/.exec(css)?.[1] ?? 0),
    });
  }

  const children = new Map();
  for (const [id, entry] of placement) children.set(entry.parent, [...(children.get(entry.parent) ?? []), id]);

  /** Tekstovi: id → { text, heading } */
  const texts = new Map();
  for (const match of html.matchAll(/<div id="(comp-[\w]+)"[^>]*data-testid="richTextElement"[^>]*>([\s\S]*?)<\/div><!--\/\$-->/g)) {
    const text = clean(match[2]);
    if (text) texts.set(match[1], { text, heading: /<h[1-6]\b/i.test(match[2]) });
  }

  /**
   * Slike (WPhoto): `<img id="img_<comp>" src="…/media/<id>/v1/crop/x_,y_,w_,h_/fill/…/<naziv>" alt="…">`.
   * `crop` je isečak koji je proizvođač sam izabrao za prikaz — čuva se da bi se
   * preuzela ista zvanična kompozicija u punoj rezoluciji, a ne umanjena sličica.
   */
  const photos = new Map();
  for (const match of html.matchAll(/<img\b[^>]*\bid="img_(comp-[\w]+)"[^>]*>/g)) {
    const tag = match[0];
    const src = decode(/\bsrc="([^"]+)"/.exec(tag)?.[1] ?? "");
    const id = mediaId(src);
    if (!id || photos.has(match[1])) continue;
    const crop = /\/crop\/x_(\d+),y_(\d+),w_(\d+),h_(\d+)/.exec(src);
    photos.set(match[1], {
      mediaId: id,
      crop: crop ? { x: Number(crop[1]), y: Number(crop[2]), w: Number(crop[3]), h: Number(crop[4]) } : null,
      displayWidth: Number(/\bwidth="(\d+)"/.exec(tag)?.[1] ?? 0) || null,
      displayHeight: Number(/\bheight="(\d+)"/.exec(tag)?.[1] ?? 0) || null,
      alt: clean(/\balt="([^"]*)"/.exec(tag)?.[1] ?? "") || null,
      fileName: decodeURIComponent(src.split("/").pop() ?? "") || null,
    });
  }

  /**
   * Galerije. HTML nosi samo prve slajdove, ali stranica ugrađuje JSON SVIH stavki svake
   * galerije, sa naslovom koji je proizvođač dao slici („250gr Liquid Paste”, „Velcro
   * Polishing Sponge Orange”). Naslov je dokaz KOJI proizvod/boju slika prikazuje.
   * Stavke iste galerije stoje u JSON-u jedna za drugom (`},{"itemId"`).
   */
  const galleryGroups = [];
  let lastEnd = -1;
  for (const match of html.matchAll(/\{"itemId":"[^"]+"[^{}]*?"metaData":\{"title":"((?:[^"\\]|\\.)*)"(?:[^{}]|\{[^{}]*\})*?"height":(\d+),"width":(\d+)(?:[^{}]|\{[^{}]*\})*?\},"mediaUrl":"([^"]+)"\}/g)) {
    const item = { mediaId: match[4], title: clean(match[1].replace(/\\u0026/g, "&")) || null, width: Number(match[3]), height: Number(match[2]) };
    if (match.index === lastEnd + 1 && galleryGroups.length) galleryGroups[galleryGroups.length - 1].push(item);
    else galleryGroups.push([item]);
    lastEnd = match.index + match[0].length;
  }
  const galleries = new Map();
  for (const match of html.matchAll(/<div id="pro-gallery-(comp-[\w]+)"[\s\S]{0,60000}?<\/section>/g)) {
    const visible = [...match[0].matchAll(/static\.wixstatic\.com\/media\/([\w]+_[\w]+~mv2\.(?:jpe?g|png|webp))/gi)].map((item) => item[1]);
    const group = galleryGroups.find((items) => items.some((item) => visible.includes(item.mediaId)));
    if (group && !galleries.has(match[1])) galleries.set(match[1], group.map((item) => ({ mediaId: item.mediaId, crop: null, displayWidth: null, displayHeight: null, alt: item.title, fileName: item.mediaId, originalWidth: item.width, originalHeight: item.height })));
  }

  /** Vektorski uzorak boje uz red tabele: boja popune SVG-a. */
  const swatches = new Map();
  for (const match of html.matchAll(/<div id="(comp-[\w]+)"[^>]*class="[^"]*"[^>]*>\s*(?:<!--[^>]*-->\s*)*<div[^>]*data-testid="svgRoot[^"]*"[\s\S]{0,1200}?<\/svg>/g)) {
    const fill = /fill="(#[0-9a-fA-F]{3,8})"/.exec(match[0])?.[1] ?? /fill:\s*(#[0-9a-fA-F]{3,8})/.exec(match[0])?.[1];
    if (fill) swatches.set(match[1], fill.toUpperCase());
  }
  // Boja uzorka je najčešće u CSS promenljivoj komponente.
  for (const match of html.matchAll(/#(comp-[\w]+)\s*\{[^}]*?--fill:\s*([^;}]+)[;}]/g)) {
    if (types[match[1]] === "VectorImage" && !swatches.has(match[1])) swatches.set(match[1], match[2].trim());
  }

  const sections = Object.keys(types).filter((id) => types[id] === "ClassicSection" && children.has(id));

  const blocks = [];
  for (const section of sections) {
    const cells = [];
    const images = [];
    const vectorRows = [];
    const walk = (id, offsetLeft, rowPath) => {
      for (const child of children.get(id) ?? []) {
        const place = placement.get(child);
        const left = offsetLeft + place.left;
        const path = [...rowPath, place.row];
        const type = types[child];
        if (texts.has(child)) cells.push({ id: child, ...texts.get(child), left, rowKey: path.join("."), rowPath: path });
        if (photos.has(child)) images.push({ source: "photo", left, ...photos.get(child) });
        if (galleries.has(child)) for (const item of galleries.get(child)) images.push({ source: "gallery", left, ...item });
        if (type === "VectorImage") vectorRows.push({ rowKey: path.join("."), left, fill: swatches.get(child) ?? null });
        if (children.has(child)) walk(child, left, path);
      }
    };
    walk(section, 0, []);
    if (!cells.length) continue;
    // Dve tabele jedna ISPOD druge u istom bloku (dva reda zaglavlja sa „Code”) su DVA
    // proizvoda („Leo Ceramic Aplication Block” pa „Leo Ceramic Cloth”). Granica je red
    // naslova druge tabele: poslednji tekst bez šifre iznad njenog zaglavlja.
    const headerRows = [...new Map(cells.filter((cell) => headerKey(cell.text) === "code").map((cell) => [cell.rowKey, cell.rowPath])).values()].sort(comparePaths);
    if (headerRows.length > 1) {
      const codeRowKeys = new Set(cells.filter((cell) => CODE.test(cell.text.replace(/\s+/g, ""))).map((cell) => cell.rowKey));
      const bounds = headerRows.slice(1).map((headerPath, index) => {
        const titleCell = cells
          .filter((cell) => !headerKey(cell.text) && !codeRowKeys.has(cell.rowKey) && comparePaths(cell.rowPath, headerPath) < 0 && comparePaths(cell.rowPath, headerRows[index]) > 0)
          .sort((a, b) => comparePaths(b.rowPath, a.rowPath))[0];
        return titleCell?.rowPath ?? headerPath;
      });
      const partOf = (rowPath) => bounds.filter((bound) => comparePaths(rowPath, bound) >= 0).length;
      for (let part = 0; part <= bounds.length; part += 1) {
        const table = buildTable(cells.filter((cell) => partOf(cell.rowPath) === part), vectorRows);
        if (table.rows.length) blocks.push({ sectionId: section, part: part + 1, order: placement.get(section)?.row ?? 0, ...table, images });
      }
      continue;
    }
    blocks.push({ sectionId: section, part: 1, order: placement.get(section)?.row ?? 0, ...buildTable(cells, vectorRows), images });
  }
  blocks.sort((a, b) => a.order - b.order || a.part - b.part);

  const pdfLinks = [...new Set([...html.matchAll(/(?:https?:\/\/[\w.-]*befar\.com\.tr\/)?_files\/ugd\/[\w]+\.pdf/g)].map((match) => match[0].replace(/^https?:\/\/[^/]+\//, "")))];
  return { blocks, pdfLinks };
}

/** Red poređenja putanja redova: [3,1] < [3,2] < [4]. */
function comparePaths(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

function buildTable(cells, vectorRows) {
  const headers = cells.filter((cell) => headerKey(cell.text)).map((cell) => ({ key: headerKey(cell.text), label: cell.text, left: cell.left, rowPath: cell.rowPath }));
  const headerIds = new Set(cells.filter((cell) => headerKey(cell.text)).map((cell) => cell.id));
  const codeCells = cells.filter((cell) => CODE.test(cell.text.replace(/\s+/g, "")));

  // Naslov bloka: prvi naslovni tekst (h2) iznad tabele; rezervno prvi tekst koji nije ćelija.
  const firstCodePath = codeCells.map((cell) => cell.rowPath).sort(comparePaths)[0] ?? null;
  const above = cells.filter((cell) => !headerIds.has(cell.id) && !CODE.test(cell.text) && (!firstCodePath || comparePaths(cell.rowPath, firstCodePath) < 0));
  const title = (above.find((cell) => cell.heading) ?? above[0] ?? cells.find((cell) => cell.heading))?.text ?? null;

  /**
   * Ista tabela ume da stoji DVAPUT u jednom bloku, jedna pored druge (Leo Ceramic
   * Aplication Block: „Color Code Size | Color Code Size”). Zato se kolone ne vezuju
   * za prvo zaglavlje datog ključa nego za NAJBLIŽE zaglavlje po x-poziciji, a
   * red se deli na onoliko zapisa koliko ima šifara u njemu.
   */
  const byRow = new Map();
  for (const cell of cells) {
    if (headerIds.has(cell.id) || cell.text === title) continue;
    byRow.set(cell.rowKey, [...(byRow.get(cell.rowKey) ?? []), cell]);
  }

  const rows = [];
  const notes = [];
  for (const [rowKey, rowCells] of [...byRow.entries()].sort((a, b) => comparePaths(a[1][0].rowPath, b[1][0].rowPath))) {
    const sorted = [...rowCells].sort((a, b) => a.left - b.left);
    const codes = sorted.filter((cell) => CODE.test(cell.text.replace(/\s+/g, "")));
    if (!codes.length) {
      for (const cell of sorted) notes.push({ text: cell.text, rowKey });
      continue;
    }
    for (const codeCell of codes) {
      // Ćelije koje pripadaju ovoj šifri: bliže njoj nego bilo kojoj drugoj šifri u redu.
      const mine = sorted.filter((cell) => cell === codeCell || (!CODE.test(cell.text.replace(/\s+/g, "")) && codes.every((other) => other === codeCell || Math.abs(cell.left - codeCell.left) < Math.abs(cell.left - other.left))));
      const record = { code: codeCell.text.replace(/\s+/g, ""), rowKey, cells: {} };
      for (const cell of mine) {
        if (cell === codeCell) continue;
        const header = headers.filter((entry) => entry.key !== "code").sort((a, b) => Math.abs(a.left - cell.left) - Math.abs(b.left - cell.left))[0];
        // Bez zaglavlja: levo od šifre je naziv/boja, desno je mera.
        const key = header && Math.abs(header.left - cell.left) <= 90 ? header.key : cell.left < codeCell.left ? "label" : "size";
        record.cells[key] = record.cells[key] ? `${record.cells[key]} ${cell.text}` : cell.text;
      }
      const swatch = vectorRows.filter((vector) => vector.rowKey === rowKey && vector.left < codeCell.left).sort((a, b) => b.left - a.left)[0];
      if (swatch?.fill) record.swatch = swatch.fill;
      rows.push(record);
    }
  }

  return {
    title,
    columns: [...new Set(headers.map((header) => header.key))],
    rows,
    // Tekst van tabele u bloku („SOFT”, „EXTRA”, „SANDWICH”): oznaka tvrdoće/serije koju proizvođač štampa uz tabelu.
    notes: notes.map((note) => note.text).filter((text) => text !== title),
  };
}
