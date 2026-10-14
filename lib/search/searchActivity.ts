/**
 * Zajednički signal „pretraga radi” (samo klijent): dok se indeks pretrage preuzima i priprema,
 * naknadna učitavanja (sporedni slajdovi kampanja) čekaju, da korisnikova pretraga ima prednost
 * na mreži. Brojač, ne zastavica: istovremeni pozivi se ne poništavaju.
 */
const EVENT = "cs-search-activity";
let active = 0;

export function isSearchActive() {
  return active > 0;
}

export async function withSearchActivity<T>(work: () => Promise<T>): Promise<T> {
  active += 1;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
  try {
    return await work();
  } finally {
    active -= 1;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
  }
}

/** Poziva `callback` kada pretraga ne radi (odmah, ako već ne radi). Vraća funkciju za odjavu. */
export function whenSearchIdle(callback: () => void): () => void {
  if (!isSearchActive()) {
    callback();
    return () => {};
  }
  const onChange = () => {
    if (isSearchActive()) return;
    window.removeEventListener(EVENT, onChange);
    callback();
  };
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
