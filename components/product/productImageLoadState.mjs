/**
 * Stanje učitavanja jedne `<img>` slike: `loading` → `loaded` | `failed`.
 *
 * JEDINA implementacija ovog stanja u projektu. React ga dobija isključivo kroz
 * `useProductImageLoadState` (tanak adapter), a koriste ga:
 *   - V6 kartica — njena CSS senka je poseban element ispod slike, pa bi bez
 *     ovoga stajala sama dok slika putuje (ili zauvek, ako slika padne);
 *   - tamna tema — ploča u boji studijske pozadine ne sme ostati prazna, a
 *     slika koja padne prelazi u pošten prikaz „Vizuel u pripremi".
 *
 * Zašto spolja, a ne `onLoad`/`onError` na `next/image`: njegov `onError`
 * ponovo dodeljuje `img.src`, a `onLoad` opali i za slomljenu sliku koja je već
 * `complete`. Sam DOM element je jedini pouzdan svedok.
 *
 * Tri slučaja koja `load` događaj sam NE pokriva:
 *   - slika je već u kešu, pa je `load` opalio pre nego što je React stigao da
 *     se zakači (`complete` je već `true`);
 *   - slika je pala pre hidracije (`complete` je `true`, `naturalWidth` je 0);
 *   - `load` stiže PRE dekodiranja (`decoding="async"`), pa bi senka bila
 *     nacrtana frejm-dva pre proizvoda — zato se čeka `decode()`.
 *
 * Četvrti slučaj je PONOVNO montiranje: katalog posle pretrage zameni instancu
 * kartice, a slika je tada već dekodirana u memoriji pregledača. Čekanje na
 * `decode()` bi tu ugasilo senku na jedan frejm ispod proizvoda koji se sve
 * vreme vidi. Zato se adresa (`currentSrc`) jednom dekodirane slike pamti, i
 * za nju se ishod javlja SINHRONO — pozivalac iz layout efekta tako stiže pre
 * prvog crtanja. Uslov je i dalje `complete` uz `naturalWidth > 0`, pa slika
 * koja nije stvarno tu nikad ne dobija senku unapred.
 *
 * Namerno bez React-a i bez DOM tipova: testira se lažnim `img` objektom.
 *
 * @typedef {"loading" | "loaded" | "failed"} ProductImageLoadState
 */

/** `currentSrc` slika koje su u ovoj sesiji već učitane I dekodirane. */
const decodedSources = new Set();

/**
 * @param {HTMLImageElement} img
 * @param {(state: "loaded" | "failed") => void} onSettle zove se pri svakoj
 *   promeni ishoda (novi `srcset` kandidat može ponovo opaliti `load`/`error`)
 * @returns {() => void} odjava; posle nje se `onSettle` više ne zove
 */
export function watchProductImageLoad(img, onSettle) {
  let cancelled = false;
  let generation = 0;

  const settle = (state, forGeneration) => {
    if (cancelled || forGeneration !== generation) return;
    onSettle(state);
  };

  const handleLoad = () => {
    const current = ++generation;
    if (!(img.naturalWidth > 0)) {
      settle("failed", current);
      return;
    }
    const source = img.currentSrc;
    if (source && decodedSources.has(source)) {
      settle("loaded", current);
      return;
    }
    const decoded =
      typeof img.decode === "function" ? img.decode() : Promise.resolve();
    // `decode()` ume da odbije i ispravnu sliku (npr. element je u međuvremenu
    // pomeren u DOM-u). Slika sa `naturalWidth > 0` je učitana u svakom slučaju.
    Promise.resolve(decoded)
      .catch(() => undefined)
      .then(() => {
        if (source) decodedSources.add(source);
        settle("loaded", current);
      });
  };

  const handleError = () => settle("failed", ++generation);

  img.addEventListener("load", handleLoad);
  img.addEventListener("error", handleError);
  if (img.complete) {
    if (img.naturalWidth > 0) handleLoad();
    // `complete` bez adrese znači da preuzimanje još nije ni počelo (nema `src`),
    // a ne da je slika pala — tada se čeka pravi `load`/`error`.
    else if (img.currentSrc) handleError();
  }

  return () => {
    cancelled = true;
    img.removeEventListener("load", handleLoad);
    img.removeEventListener("error", handleError);
  };
}
