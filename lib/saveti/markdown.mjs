/**
 * Markdown podskup za članke rubrike „Saveti i vodiči“.
 *
 * Namerno mali i strog: sve što parser ne razume je greška pri buildu, a ne
 * tiho propušten tekst. Sirov HTML nije dozvoljen, pa članak ne može da unese
 * skriptu ni stil — prikaz je uvek naša React komponenta.
 *
 * Blokovi:
 *   ## Naslov / ### Podnaslov
 *   pasus
 *   - stavka / 1. stavka            (jedan nivo; nastavak reda uvučen razmakom)
 *   | tabela | sa | zaglavljem |      (drugi red: | --- | --- |)
 *   > [!napomena] / [!upozorenje]   (istaknut okvir; sledeći redovi počinju sa >)
 *
 * U redu teksta:
 *   **jako**, *naglašeno*, `kod`, [tekst](/putanja ili https://…), [^izvor]
 */

const CALLOUT_KINDS = new Set(["napomena", "upozorenje", "savet"]);

export function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Red teksta → niz inline čvorova. */
export function parseInline(source, errors, where) {
  const nodes = [];
  let text = "";
  const flush = () => {
    if (text) nodes.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    if (rest.startsWith("<")) {
      const tag = /^<\/?[a-zA-Z!]/.test(rest);
      if (tag) errors.push(`${where}: sirov HTML nije dozvoljen („${rest.slice(0, 20)}…“)`);
    }
    let match;
    if ((match = /^\[\^([a-z0-9][a-z0-9-]*)\]/.exec(rest))) {
      flush();
      nodes.push({ t: "cite", id: match[1] });
      i += match[0].length;
      continue;
    }
    if ((match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) {
      flush();
      nodes.push({ t: "link", href: match[2], c: parseInline(match[1], errors, where) });
      i += match[0].length;
      continue;
    }
    if ((match = /^\*\*([^*]+)\*\*/.exec(rest))) {
      flush();
      nodes.push({ t: "strong", c: parseInline(match[1], errors, where) });
      i += match[0].length;
      continue;
    }
    if ((match = /^\*([^*\s][^*]*)\*/.exec(rest))) {
      flush();
      nodes.push({ t: "em", c: parseInline(match[1], errors, where) });
      i += match[0].length;
      continue;
    }
    if ((match = /^`([^`]+)`/.exec(rest))) {
      flush();
      nodes.push({ t: "code", v: match[1] });
      i += match[0].length;
      continue;
    }
    text += source[i];
    i += 1;
  }
  flush();
  return nodes;
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * @param {string} body  Markdown telo (bez frontmatter-a)
 * @param {string} [label]
 * @returns {{ blocks: any[], errors: string[] }}
 */
export function parseArticleMarkdown(body, label = "članak") {
  const errors = [];
  const blocks = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const headingIds = new Set();
  let i = 0;

  const where = (n) => `${label}:${n + 1}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    let match;
    if ((match = /^(#{1,6})\s+(.+?)\s*$/.exec(line))) {
      const level = match[1].length;
      if (level === 1) errors.push(`${where(i)}: H1 je naslov članka — u telu koristite ## i ###`);
      if (level > 3) errors.push(`${where(i)}: dozvoljeni su samo ## i ###`);
      let id = slugifyHeading(match[2]);
      let n = 2;
      while (headingIds.has(id)) id = `${slugifyHeading(match[2])}-${n++}`;
      headingIds.add(id);
      blocks.push({ t: "h", level: Math.min(Math.max(level, 2), 3), id, c: parseInline(match[2], errors, where(i)) });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      let kind = "napomena";
      const first = /^\[!([a-z]+)\]\s*(.*)$/.exec(quoted[0] ?? "");
      if (first) {
        if (!CALLOUT_KINDS.has(first[1])) errors.push(`${where(i - quoted.length)}: nepoznat okvir [!${first[1]}]`);
        kind = first[1];
        quoted[0] = first[2];
      }
      const paragraphs = quoted
        .join("\n")
        .split(/\n\s*\n/)
        .map((chunk) => chunk.replace(/\n/g, " ").trim())
        .filter(Boolean)
        .map((chunk) => parseInline(chunk, errors, where(i)));
      blocks.push({ t: "callout", kind, c: paragraphs });
      continue;
    }

    if (/^\|/.test(line)) {
      const header = splitRow(line);
      if (!isTableSeparator(lines[i + 1] ?? "")) {
        errors.push(`${where(i)}: tabela mora imati red razdvajanja (| --- |)`);
        i += 1;
        continue;
      }
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const row = splitRow(lines[i]);
        if (row.length !== header.length) {
          errors.push(`${where(i)}: red tabele ima ${row.length} kolona, zaglavlje ${header.length}`);
        }
        rows.push(row.map((cell) => parseInline(cell, errors, where(i))));
        i += 1;
      }
      blocks.push({ t: "table", head: header.map((cell) => parseInline(cell, errors, where(i))), rows });
      continue;
    }

    const listMatch = /^(\s*)([-*]|\d+\.)\s+/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        const item = /^([-*]|\d+\.)\s+(.*)$/.exec(current);
        if (item) {
          if (/\d+\./.test(item[1]) !== ordered) break;
          items.push(item[2]);
          i += 1;
          continue;
        }
        if (/^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`;
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ t: ordered ? "ol" : "ul", items: items.map((item) => parseInline(item, errors, where(i))) });
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|>|\||([-*]|\d+\.)\s)/.test(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ t: "p", c: parseInline(paragraph.join(" "), errors, where(i)) });
  }

  return { blocks, errors };
}

/**
 * Običan tekst inline čvorova (za brojanje reči, opise i proveru jezika).
 * @param {any[]} nodes
 * @returns {string}
 */
export function inlineText(nodes) {
  return (nodes ?? [])
    .map((node) => {
      if (node.t === "text" || node.t === "code") return node.v;
      if (node.t === "cite") return "";
      return inlineText(node.c);
    })
    .join("");
}

/**
 * Tekstualni sadržaj blokova, po jedan zapis na blok (pasus, stavka, red tabele).
 * @param {any[]} blocks
 * @returns {{ block: any, text: string, nodes: any[] }[]}
 */
export function blockTexts(blocks) {
  const out = [];
  for (const block of blocks) {
    if (block.t === "p" || block.t === "h") out.push({ block, text: inlineText(block.c), nodes: block.c });
    else if (block.t === "ul" || block.t === "ol") {
      for (const item of block.items) out.push({ block, text: inlineText(item), nodes: item });
    } else if (block.t === "table") {
      out.push({ block, text: block.head.map(inlineText).join(" | "), nodes: block.head.flat() });
      for (const row of block.rows) out.push({ block, text: row.map(inlineText).join(" | "), nodes: row.flat() });
    } else if (block.t === "callout") {
      for (const paragraph of block.c) out.push({ block, text: inlineText(paragraph), nodes: paragraph });
    }
  }
  return out;
}

/**
 * Svi inline čvorovi datog tipa, rekurzivno.
 * @param {any[]} blocks
 * @param {string} type
 * @returns {any[]}
 */
export function collectInline(blocks, type) {
  const found = [];
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      if (node.t === type) found.push(node);
      if (node.c) walk(node.c);
    }
  };
  for (const block of blocks) {
    if (block.c && block.t !== "callout") walk(block.c);
    if (block.t === "callout") block.c.forEach(walk);
    if (block.items) block.items.forEach(walk);
    if (block.head) block.head.forEach(walk);
    if (block.rows) block.rows.forEach((row) => row.forEach(walk));
  }
  return found;
}

/** @param {any[]} blocks */
export function wordCount(blocks) {
  return blockTexts(blocks)
    .map(({ text }) => text)
    .join(" ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
