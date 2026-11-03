/**
 * Urednik članaka: Markdown podskup rubrike ↔ HTML za uređivanje (bez pisanja koda).
 *
 * Urednik vidi formatiran tekst (podnaslovi, podebljano, liste, linkovi). Tabele, istaknuti okviri
 * i oznake izvora ([^izvor]) su „ostrva“: prikazuju se, mogu da se obrišu ili premeste, ali se ne
 * kucaju — tako ostaju ispravni. Čuva se uvek Markdown podskup (lib/saveti/markdown.mjs), pa javni
 * prikaz i provera ostaju isti kao za tekstove iz repozitorijuma.
 *
 * Ovaj modul je čist (bez DOM-a): HTML → Markdown radi klijentska komponenta, a ovde su pravila
 * za blokove i inline čvorove, da bi se mogla testirati.
 */
import { parseArticleMarkdown } from "../markdown.mjs";

export function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Inline čvorovi → Markdown. */
export function inlineUMarkdown(nodes) {
  return (nodes ?? [])
    .map((n) => {
      switch (n.t) {
        case "text":
          return n.v;
        case "code":
          return `\`${n.v}\``;
        case "cite":
          return `[^${n.id}]`;
        case "strong":
          return `**${inlineUMarkdown(n.c)}**`;
        case "em":
          return `*${inlineUMarkdown(n.c)}*`;
        case "link":
          return `[${inlineUMarkdown(n.c)}](${n.href})`;
        default:
          return "";
      }
    })
    .join("");
}

/** Blok → Markdown (kanonski zapis). */
export function blokUMarkdown(b) {
  switch (b.t) {
    case "h":
      return `${b.level === 3 ? "###" : "##"} ${inlineUMarkdown(b.c)}`;
    case "p":
      return inlineUMarkdown(b.c);
    case "ul":
      return b.items.map((item) => `- ${inlineUMarkdown(item)}`).join("\n");
    case "ol":
      return b.items.map((item, i) => `${i + 1}. ${inlineUMarkdown(item)}`).join("\n");
    case "table": {
      const row = (cells) => `| ${cells.map((c) => inlineUMarkdown(c).replace(/\|/g, "/")).join(" | ")} |`;
      return [row(b.head), `| ${b.head.map(() => "---").join(" | ")} |`, ...b.rows.map(row)].join("\n");
    }
    case "callout":
      // Pasusi u okviru se razdvajaju praznim redom „>“, inače ih parser spaja u jedan.
      return [`> [!${b.kind}]`, ...b.c.flatMap((par, i) => [...(i ? [">"] : []), `> ${inlineUMarkdown(par)}`])].join("\n");
    default:
      return "";
  }
}

export function blokoviUMarkdown(blocks) {
  return blocks.map(blokUMarkdown).filter(Boolean).join("\n\n");
}

function inlineUHtml(nodes) {
  return (nodes ?? [])
    .map((n) => {
      switch (n.t) {
        case "text":
          return escapeHtml(n.v);
        case "code":
          return `<code>${escapeHtml(n.v)}</code>`;
        case "cite":
          return `<span class="ed-cite" contenteditable="false" data-cite="${escapeHtml(n.id)}">[${escapeHtml(n.id)}]</span>`;
        case "strong":
          return `<strong>${inlineUHtml(n.c)}</strong>`;
        case "em":
          return `<em>${inlineUHtml(n.c)}</em>`;
        case "link":
          return `<a href="${escapeHtml(n.href)}">${inlineUHtml(n.c)}</a>`;
        default:
          return "";
      }
    })
    .join("");
}

const CALLOUT = { napomena: "Napomena", upozorenje: "Upozorenje", savet: "Savet" };

/** Markdown → HTML za urednik. Ostrva nose svoj Markdown u `data-md`. */
export function markdownUHtml(md) {
  const { blocks } = parseArticleMarkdown(md ?? "", "urednik");
  if (!blocks.length) return "<p><br></p>";
  return blocks
    .map((b) => {
      switch (b.t) {
        case "h":
          return `<h${b.level}>${inlineUHtml(b.c)}</h${b.level}>`;
        case "p":
          return `<p>${inlineUHtml(b.c)}</p>`;
        case "ul":
        case "ol":
          return `<${b.t}>${b.items.map((item) => `<li>${inlineUHtml(item)}</li>`).join("")}</${b.t}>`;
        case "table":
          return `<div class="ed-ostrvo" contenteditable="false" data-md="${escapeHtml(blokUMarkdown(b))}" data-vrsta="Tabela"><table><thead><tr>${b.head
            .map((c) => `<th>${inlineUHtml(c)}</th>`)
            .join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineUHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        case "callout":
          return `<div class="ed-ostrvo" contenteditable="false" data-md="${escapeHtml(blokUMarkdown(b))}" data-vrsta="${CALLOUT[b.kind] ?? "Okvir"}">${b.c
            .map((par) => `<p>${inlineUHtml(par)}</p>`)
            .join("")}</div>`;
        default:
          return "";
      }
    })
    .join("");
}

/** Tekst iz urednika ne sme da otvori Markdown oznaku koju korisnik nije nameravao. */
export function cistTekst(text) {
  return String(text)
    .replace(/ /g, " ")
    .replace(/[​‌‍﻿]/g, "")
    .replace(/\*/g, "∗")
    .replace(/`/g, "’")
    .replace(/\[\^/g, "[ ^")
    .replace(/\n/g, " ");
}

/** Dozvoljena adresa linka: putanja sajta, https ili mailto. */
export function dozvoljenLink(href) {
  const h = String(href ?? "").trim();
  if (/^\/[^\s]*$/.test(h) && !h.startsWith("//")) return h;
  if (/^https:\/\/[^\s]+$/.test(h)) return h;
  if (/^mailto:[^\s@]+@[^\s@]+$/.test(h)) return h;
  return null;
}
