/**
 * Najveći broj stavki koje prodajni ekrani učitavaju jednim upitom.
 *
 * Odvojeno od `queries.ts` da bi ekrani (i komponente bez pristupa bazi) mogli
 * da prepoznaju kada je granica dostignuta i to KAŽU korisniku — zbirovi nad
 * skraćenim skupom nisu zbirovi celog perioda.
 */
export const SALES_LINES_LIMIT = 20000;
