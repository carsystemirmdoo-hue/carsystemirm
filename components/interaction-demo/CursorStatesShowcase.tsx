import Link from "next/link";
import type { CarsystemBrand, CarsystemProduct } from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import styles from "./CursorStatesShowcase.module.css";

/*
 * Interni demo za sedam cursor stanja: text, headline, image (neklikabilna),
 * image-open (klikabilna), button, link, i product visual (image state na
 * stvarnoj ProductVisualSurface komponenti). Svaka pločica je označena tako
 * da je jasno koje stanje demonstrira tokom light/dark provere.
 */
export function CursorStatesShowcase({
  product,
  brand,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.themeToggle}>
        <ThemeToggle />
      </div>

      <p className={styles.eyebrow}>Interni prikaz interakcije</p>
      <h1 className={styles.h1} data-cursor="headline">
        Cursor states demo
      </h1>
      <p className={styles.lead} data-cursor="text">
        Pređi mišem preko elemenata ispod da vidiš kako se orb ponaša nad
        običnim tekstom, naslovom, slikama i interaktivnim elementima. Radi
        samo sa preciznim pokazivačem (miš); na dodirnim uređajima i uz
        smanjeno kretanje custom kursor se ne prikazuje.
      </p>

      <section className={styles.grid} aria-label="Cursor stanja">
        <article className={styles.tile}>
          <p className={styles.tileLabel}>text — običan pasus</p>
          <p className={styles.paragraph} data-cursor="text">
            Ovo je običan opisni pasus, sličan onima u produktnim
            specifikacijama ili pomoćnom tekstu. Kursor treba da postane
            mirniji i precizniji dok ga čitaš, bez velikog sjaja.
          </p>
        </article>

        <article className={styles.tile}>
          <p className={styles.tileLabel}>headline — H2 naslov</p>
          <h2 className={styles.demoHeadline} data-cursor="headline">
            Veliki naslov sekcije
          </h2>
        </article>

        <article className={styles.tile}>
          <p className={styles.tileLabel}>image — neklikabilna slika</p>
          <div className={styles.imageFrame} data-cursor="image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/interaction-demo/spray-paint.png"
              alt="Neklikabilan packshot, samo za prikaz"
              className={styles.imageAsset}
            />
          </div>
        </article>

        <article className={styles.tile}>
          <p className={styles.tileLabel}>image-open — klikabilna slika</p>
          <Link
            className={`${styles.imageFrame} cs-image-surface`}
            href={`/proizvodi/${product.slug}`}
            aria-label={`Pogledaj proizvod ${product.name}`}
            data-cursor="image"
            data-motion-surface
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/interaction-demo/basecoat.png"
              alt=""
              className={styles.imageAsset}
            />
          </Link>
        </article>

        <article className={styles.tile}>
          <p className={styles.tileLabel}>button — CTA</p>
          <Link
            className={`${styles.cta} cs-magnetic-cta cs-theme-wipe-card`}
            href="/kontakt"
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
          >
            <span>Pošalji upit</span>
          </Link>
        </article>

        <article className={styles.tile}>
          <p className={styles.tileLabel}>link — običan link</p>
          <Link className={`${styles.link} cs-link-reveal`} href="/katalog" data-cursor="link">
            Pregledajte katalog →
          </Link>
        </article>

        <article className={`${styles.tile} ${styles.tileWide}`}>
          <p className={styles.tileLabel}>image — product visual (packshot)</p>
          <div
            className={`${styles.productVisualFrame} cs-image-surface`}
            data-cursor="image"
            data-motion-surface
          >
            <ProductVisualSurface
              brandName={brand.name}
              product={product}
              sizes="(min-width: 768px) 40vw, 88vw"
            />
          </div>
        </article>
      </section>
    </main>
  );
}
