import Image from "next/image";
import Link from "next/link";
import styles from "./BaslacBrandPage.styles";

/*
 * Sive nijanse 20-24 / 20-34 / 20-94 (2026-10-19).
 *
 * Odnosi mešanja nijansi su prepisani sa zvaničnog baslac postera
 * „Grey-Shades_20-24_-34_-94.pdf“ (str. 1, odeljak 1, zapreminski %; ista
 * kopija je u public/documents). Poster daje tačno pet nivoa: tri baze i dve
 * mešavine 50/50 susednih baza — ništa više se ne izvodi. Odnos sa
 * učvršćivačem i razređivačem je posebna stvar i dolazi iz tehničkih listova
 * (TDS 20-24 i 20-34 rev. 09/2025, 20-94 rev. 06/2023, str. 1–2).
 * Boje uzoraka su ilustrativne, ne koloristička referenca.
 */
const POSTER_HREF = "/documents/baslac/guides/baslac-grey-shades-20-24-34-94.pdf";

const shadeLevels = [
  { name: "Bela", swatch: "#ecece8", parts: [{ code: "20-34", share: 100 }] },
  {
    name: "Svetlosiva",
    swatch: "#bfc2c0",
    parts: [
      { code: "20-34", share: 50 },
      { code: "20-24", share: 50 },
    ],
  },
  { name: "Siva", swatch: "#8b908f", parts: [{ code: "20-24", share: 100 }] },
  {
    name: "Tamnosiva",
    swatch: "#55595a",
    parts: [
      { code: "20-24", share: 50 },
      { code: "20-94", share: 50 },
    ],
  },
  { name: "Crna", swatch: "#232527", parts: [{ code: "20-94", share: 100 }] },
] as const;

const baseColor: Record<string, string> = {
  "20-34": "#ecece8",
  "20-24": "#8b908f",
  "20-94": "#232527",
};

const primerFillers = [
  {
    code: "20-34",
    name: "2K Primerfiller White",
    image: "/products/baslac/baslac--20-34-2k-primerfiller-white-4l-packshot.webp",
    href: "/proizvodi/grupa/20-34-2k-primerfiller-white",
    tds: "/documents/products/baslac/20-34.pdf",
    tdsRevision: "09/2025",
  },
  {
    code: "20-24",
    name: "2K Primerfiller Grey",
    image: "/products/baslac/baslac--20-24-2k-primerfiller-grey-1l-packshot.webp",
    href: "/proizvodi/grupa/20-24-2k-primerfiller-grey",
    tds: "/documents/products/baslac/20-24.pdf",
    tdsRevision: "09/2025",
  },
  {
    code: "20-94",
    name: "2K Primerfiller Black",
    image: "/products/baslac/baslac--20-94-2k-primerfiller-black-4l-packshot.webp",
    href: "/proizvodi/grupa/20-94-2k-primerfiller-black",
    tds: "/documents/products/baslac/20-94.pdf",
    tdsRevision: "06/2023",
  },
] as const;

export function BaslacGreyShade() {
  // Blok postaje taman zajedno sa okvirom sajta (components/theme/FrameThemeController).
  return (
    <section
      id="grey-shade"
      className={`${styles.section} ${styles.greyShadeSection}`}
      data-frame-theme="dark"
      aria-labelledby="baslac-grey-shade-title"
    >
      <div className={styles.greyShadeIntro}>
        <p className={styles.sectionKicker}>Sanding primer-filler sistem</p>
        <h2 id="baslac-grey-shade-title">
          Tri baze, pet nivoa sive podloge.
        </h2>
        <p>
          Punila 20-34 (belo), 20-24 (sivo) i 20-94 (crno) daju podlogu bližu
          boji koja sledi. Prema baslac posteru sivih nijansi, mešaju se samo
          susedne baze, pola-pola.
        </p>
      </div>

      <figure className={styles.greyShadeScale}>
        <ol aria-label="Nivoi sive podloge i udeo baza, zapreminski">
          {shadeLevels.map((level) => (
            <li key={level.name}>
              <span
                className={styles.greyShadeSwatch}
                style={{ background: level.swatch }}
                aria-hidden="true"
              />
              <strong>{level.name}</strong>
              <span
                className={styles.greyShadeRecipeBar}
                aria-hidden="true"
              >
                {level.parts.map((part) => (
                  <span
                    key={part.code}
                    style={{ flexGrow: part.share, background: baseColor[part.code] }}
                  />
                ))}
              </span>
              <small>
                {level.parts
                  .map((part) => `${part.share} % ${part.code}`)
                  .join(" + ")}
              </small>
            </li>
          ))}
        </ol>
        <figcaption>
          Zapreminski udeo baza prema{" "}
          <a href={POSTER_HREF}>baslac posteru sivih nijansi (PDF)</a>. Uzorci
          na ekranu su ilustrativni, ne koloristička referenca.
        </figcaption>
      </figure>

      <div className={styles.greyShadeDetails}>
        <ul className={styles.greyShadeProducts} aria-label="Baze u katalogu">
          {primerFillers.map((product) => (
            <li key={product.code}>
              <Link href={product.href}>
                <span className={styles.greyShadeProductImage}>
                  <Image
                    src={product.image}
                    alt=""
                    fill
                    sizes="5rem"
                  />
                </span>
                <span>
                  <strong>{product.code}</strong>
                  <span>{product.name}</span>
                  <small>1 L · 4 L</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.greyShadeHardener}>
          <h3>Posle izbora nijanse: učvršćivač i razređivač</h3>
          <p>
            Odvojeno od mešanja nijansi. Za sve tri baze tehnički list navodi{" "}
            <strong>4 : 1 : 1</strong> zapreminski: 100 % punila, 25 %
            učvršćivača 50-15 ili 50-20 i 25 % razređivača 60-10, 60-20 ili
            60-30 (60-40 navode samo listovi za 20-24 i 20-34). Vreme upotrebe
            na 20 °C: 1 h.
          </p>
          <p className={styles.greyShadeSources}>
            Tehnički listovi:{" "}
            {primerFillers.map((product, index) => (
              <span key={product.code}>
                <a href={product.tds}>
                  {product.code} ({product.tdsRevision})
                </a>
                {index < primerFillers.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
          <div className={styles.greyShadeActions}>
            <Link
              className={`${styles.primaryButton} cs-cta`}
              data-cta-on="dark"
              href="/katalog?brend=baslac&q=2K%20Primerfiller"
            >
              Pogledajte punila u katalogu
              <span aria-hidden="true">→</span>
            </Link>
            <a className={styles.greyShadePosterLink} href={POSTER_HREF}>
              Poster sivih nijansi (PDF)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
