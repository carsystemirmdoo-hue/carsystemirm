import { sql, type SQL } from "drizzle-orm";

/*
 * Pretraga bez obzira na kvačice i veličinu slova.
 *
 * Baza radi u kolaciji „C“: ILIKE tamo ne izjednačava „đ“ i „Đ“, a nazivi iz
 * BizniSofta se pišu i „RAZREĐIVAČ“ i „RAZREDJIVAC“. Obe strane se zato svode
 * na ASCII velika slova (đ → DJ, č/ć → C, ž → Z, š → S) pre poređenja.
 */
export function foldText(value: string): string {
  return value.replace(/đ/g, "dj").replace(/Đ/g, "DJ").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const foldSql = (expr: SQL) => sql`upper(translate(replace(replace(coalesce(${expr}, ''), 'đ', 'dj'), 'Đ', 'DJ'), 'čćžšČĆŽŠ', 'cczsCCZS'))`;

/** Svaka reč upita mora da se nađe u bar jednoj koloni (I po rečima, ILI po kolonama). */
export function foldedMatch(columns: SQL[], query: string): SQL {
  const words = foldText(query).split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return sql`true`;
  return sql.join(
    words.map((w) => {
      const term = `%${w.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      return sql`(${sql.join(columns.map((c) => sql`${foldSql(c)} LIKE ${term}`), sql` OR `)})`;
    }),
    sql` AND `,
  );
}
