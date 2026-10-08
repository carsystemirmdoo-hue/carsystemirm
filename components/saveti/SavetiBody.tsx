import Link from "next/link";
import type { ReactNode } from "react";
import type { SavetiBlock, SavetiInline } from "@/lib/saveti";
import styles from "./Saveti.module.css";

type RenderContext = {
  /** Redni broj izvora po id-u (1, 2, …) — redosled iz frontmatter-a. */
  sourceNumbers: Map<string, number>;
  /** Slugovi JAVNIH članaka; link ka budućem članku postaje običan tekst. */
  publicSlugs: Set<string>;
};

function renderInline(nodes: SavetiInline[], context: RenderContext, keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.t) {
      case "text":
        return node.v;
      case "code":
        return (
          <code key={key} className={styles.code}>
            {node.v}
          </code>
        );
      case "strong":
        return <strong key={key}>{renderInline(node.c, context, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.c, context, key)}</em>;
      case "cite": {
        const number = context.sourceNumbers.get(node.id);
        if (!number) return null;
        return (
          <sup key={key} className={styles.cite}>
            <a href={`#izvor-${node.id}`} aria-label={`Izvor ${number}`}>
              [{number}]
            </a>
          </sup>
        );
      }
      case "link": {
        const children = renderInline(node.c, context, key);
        if (/^https:\/\//.test(node.href)) {
          return (
            <a key={key} href={node.href} className={styles.link} rel="noopener noreferrer" target="_blank">
              {children}
              <span className={styles.srOnly}> (otvara se u novom prozoru)</span>
            </a>
          );
        }
        const article = /^\/vodici\/([a-z0-9-]+)(?:#.*)?$/.exec(node.href);
        if (article && article[1] !== "novosti" && !context.publicSlugs.has(article[1])) {
          // Članak još nije objavljen: tekst ostaje, adresa se ne otkriva.
          return <span key={key}>{children}</span>;
        }
        return (
          <Link key={key} href={node.href} className={styles.link}>
            {children}
          </Link>
        );
      }
      default:
        return null;
    }
  });
}

const CALLOUT_LABEL: Record<string, string> = {
  napomena: "Napomena",
  upozorenje: "Upozorenje",
  savet: "Savet",
};

export function SavetiBody({
  blocks,
  sourceNumbers,
  publicSlugs,
  skipLead = false,
}: {
  blocks: SavetiBlock[];
  sourceNumbers: Map<string, number>;
  publicSlugs: Set<string>;
  /** Prvi pasus je već prikazan kao kratak odgovor. */
  skipLead?: boolean;
}) {
  const context: RenderContext = { sourceNumbers, publicSlugs };
  const visible = skipLead && blocks[0]?.t === "p" ? blocks.slice(1) : blocks;

  return (
    <div className={styles.prose}>
      {visible.map((block, index) => {
        const key = `b${index}`;
        switch (block.t) {
          case "h":
            return block.level === 2 ? (
              <h2 key={key} id={block.id}>
                {renderInline(block.c, context, key)}
              </h2>
            ) : (
              <h3 key={key} id={block.id}>
                {renderInline(block.c, context, key)}
              </h3>
            );
          case "p":
            return <p key={key}>{renderInline(block.c, context, key)}</p>;
          case "ul":
            return (
              <ul key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, context, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key}>
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, context, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={key} className={styles.tableWrap} role="region" aria-label="Tabela" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      {block.head.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col">
                          {renderInline(cell, context, `${key}-h${cellIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{renderInline(cell, context, `${key}-${rowIndex}-${cellIndex}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "callout":
            return (
              <aside key={key} className={styles.callout} data-kind={block.kind}>
                <p className={styles.calloutLabel}>{CALLOUT_LABEL[block.kind] ?? "Napomena"}</p>
                {block.c.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{renderInline(paragraph, context, `${key}-${paragraphIndex}`)}</p>
                ))}
              </aside>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/** Kratak odgovor (prvi pasus) kao istaknut uvod. */
export function SavetiLead({
  blocks,
  sourceNumbers,
  publicSlugs,
}: {
  blocks: SavetiBlock[];
  sourceNumbers: Map<string, number>;
  publicSlugs: Set<string>;
}) {
  const first = blocks[0];
  if (first?.t !== "p") return null;
  return (
    <p className={styles.lead}>{renderInline(first.c, { sourceNumbers, publicSlugs }, "lead")}</p>
  );
}
