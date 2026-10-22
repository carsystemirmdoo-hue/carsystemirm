import Link from "next/link";
import type { SavetiSazetak } from "@/lib/saveti";
import { SAVETI_TIPOVI } from "@/lib/saveti/kategorije.mjs";
import { formatSerbianDate } from "@/lib/saveti/vreme.mjs";
import styles from "./Saveti.styles";

export function SavetiCard({ clanak, showCategory = true }: { clanak: SavetiSazetak; showCategory?: boolean }) {
  const tip = (SAVETI_TIPOVI as Record<string, string>)[clanak.tip] ?? clanak.tip;
  return (
    <article className={styles.card}>
      <p className={styles.cardMeta}>
        {showCategory ? <span>{clanak.kategorijaNaziv}</span> : null}
        <span>{tip}</span>
      </p>
      <h3 className={styles.cardTitle}>
        <Link href={`/vodici/${clanak.slug}`}>{clanak.naslov}</Link>
      </h3>
      <p className={styles.cardText}>{clanak.opis}</p>
      <p className={styles.cardMeta}>
        <time dateTime={clanak.datumObjave}>{formatSerbianDate(clanak.datumObjave)}</time>
      </p>
    </article>
  );
}

export function SavetiNewsItem({ clanak }: { clanak: SavetiSazetak }) {
  return (
    <article className={styles.newsItem}>
      <p className={styles.newsDate}>
        {clanak.datumDogadjaja ? (
          <>
            Događaj: <time dateTime={clanak.datumDogadjaja}>{formatSerbianDate(clanak.datumDogadjaja)}</time>
          </>
        ) : (
          <time dateTime={clanak.datumObjave}>{formatSerbianDate(clanak.datumObjave)}</time>
        )}
        {clanak.istorijska ? (
          <>
            <br />
            <span className={styles.badge}>Istorijska vest</span>
          </>
        ) : null}
      </p>
      <div>
        <h3 className={styles.cardTitle}>
          <Link href={`/vodici/${clanak.slug}`}>{clanak.naslov}</Link>
        </h3>
        <p className={styles.cardText} style={{ marginTop: 6 }}>
          {clanak.opis}
        </p>
      </div>
    </article>
  );
}
