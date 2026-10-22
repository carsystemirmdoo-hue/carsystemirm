/** Jedna baza u zajedničkom izboru porodice (Baslac i R-M). */
export type FamilyBase = {
  code: string;
  name: string | null;
  /** Zapremina u litrima, za redosled; `null` = pakovanje na upit. */
  volumeL: number | null;
  /** Ključ grupe zapremine (stabilan, npr. „0.5“, „0.125“, „upit“). */
  volumeKey: string;
  /** Prikaz zapremine („0,5 L“, „125 ml“). */
  volumeLabel: string;
  /** Kratka napomena uz dugme zapremine („koncentrat“). */
  volumeNote?: string;
  /** Pakovanje na kartici („kanta 4 L“, „0,5 L“). */
  packLabel: string;
  finish: string;
  finishLabel: string;
  /** Boja kvadratića; bez nje kvadratić je neutralan. */
  swatch?: string;
  /** Obrazac kvadratića (`data-finish`). */
  swatchPattern: string;
  /** Vrednost za `?varijanta=`. */
  queryValue: string;
  /** Ključ varijante u `ProductVariantProvider` (R-M redovi); bez njega izbor je po slug-u. */
  contextKey?: string;
  /** Proizvod za panel kupovine. */
  buySlug: string;
  buyName: string;
  searchTerms: string[];
};

export type FamilyPackshot = { src: string; alt: string; note?: string };
