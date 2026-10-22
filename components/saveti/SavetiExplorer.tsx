"use client";

import { useMemo, useState } from "react";
import type { SavetiSazetak } from "@/lib/saveti";
import { SavetiCard } from "./SavetiCards";
import styles from "./Saveti.styles";

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Filter preko JAVNIH članaka koje je strana već izračunala na serveru.
 * Klijent ne dobija ništa više od sažetaka koji su i inače vidljivi.
 */
export function SavetiExplorer({
  articles,
  categories,
}: {
  articles: SavetiSazetak[];
  categories: { slug: string; naziv: string; broj: number }[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const visible = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return articles.filter((article) => {
      if (category && article.kategorija !== category) return false;
      if (!words.length) return true;
      const haystack = normalize(`${article.naslov} ${article.opis} ${article.kategorijaNaziv}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [articles, category, query]);

  return (
    <div>
      <div className={styles.filters}>
        <label>
          <span className={styles.srOnly}>Pretražite savete i vodiče</span>
          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pretražite, npr. prajmer za plastiku"
            autoComplete="off"
          />
        </label>
        <div className={styles.chips} role="group" aria-label="Filtrirajte po temi">
          <button type="button" className={styles.chip} aria-pressed={category === null} onClick={() => setCategory(null)}>
            Sve teme
          </button>
          {categories.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={styles.chip}
              aria-pressed={category === item.slug}
              onClick={() => setCategory(category === item.slug ? null : item.slug)}
            >
              {item.naziv} ({item.broj})
            </button>
          ))}
        </div>
      </div>
      <p className={styles.srOnly} role="status">
        {visible.length === 1 ? "Prikazan je 1 tekst" : `Prikazano tekstova: ${visible.length}`}
      </p>
      {visible.length ? (
        <div className={styles.grid}>
          {visible.map((article) => (
            <SavetiCard key={article.slug} clanak={article} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Nema tekstova za ovu pretragu. Pokušajte drugim rečima ili izaberite drugu temu.</p>
      )}
    </div>
  );
}
