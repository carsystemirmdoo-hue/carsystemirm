import Link from "next/link";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { ProductCard } from "./CarsystemProducts";
import styles from "./CarsystemBrandPage.styles";

/**
 * RUPES u okviru Carsystem ponude (odluka vlasnika 2026-10-14): proizvođač je
 * RUPES S.p.A., artikli su iz Carsystem kataloga 2026/27. Bez tvrdnji o statusu
 * distribucije i bez logotipa (nema odobrenog) — naziv RUPES je tekst.
 */
const featuredRupesSlugs = [
  "carsystem-rupes-ibrid-nano-q-maq",
  "carsystem-rupes-skorpio-e-rx",
  "carsystem-rupes-polishing-machine-lhr75e",
  "carsystem-rupes-polishing-machine-lhr15",
  "carsystem-rupes-vacuum-cleaner-s145",
] as const;

const FEATURED_COUNT = 4;

function hasProductImage(product: CarsystemProduct) {
  const image = product.productImage ?? product.galleryImages[0] ?? null;
  return Boolean(image && !image.src.includes("placeholder-product"));
}

/** Istaknuti redom iz liste (LHR15 je rezerva za LHR75E); kada nema slike, sledeći sa slikom. */
function selectFeatured(products: CarsystemProduct[]) {
  const withImage = products.filter(hasProductImage);
  const bySlug = new Map(withImage.map((product) => [product.slug, product]));
  const preferred = featuredRupesSlugs
    .filter(
      (slug) =>
        slug !== "carsystem-rupes-polishing-machine-lhr15" ||
        !bySlug.has("carsystem-rupes-polishing-machine-lhr75e"),
    )
    .map((slug) => bySlug.get(slug))
    .filter((product): product is CarsystemProduct => Boolean(product));
  const chosen = new Set(preferred.map((product) => product.slug));
  const rest = withImage.filter((product) => !chosen.has(product.slug));

  return [...preferred, ...rest].slice(0, FEATURED_COUNT);
}

export function CarsystemRupesSection({
  products,
}: {
  products: CarsystemProduct[];
}) {
  if (products.length === 0) return null;
  const featured = selectFeatured(products);

  return (
    <section
      id="rupes"
      className={`${styles.section} ${styles.rupesSection}`}
      aria-labelledby="carsystem-rupes-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>RUPES · u Carsystem programu</p>
          <h2 id="carsystem-rupes-title">Polirke, brusilice i usisivač RUPES</h2>
        </div>
        <p>
          RUPES proizvodi koje vodimo kroz Carsystem program: polirke, brusilice,
          usisivač i prateći pribor za brušenje i poliranje.
        </p>
      </header>

      <p className={styles.rupesNote}>
        Proizvođač: RUPES S.p.A. Šifre artikala su iz Carsystem kataloga 2026/27.
      </p>

      {featured.length > 0 ? (
        <div className={`${styles.productGrid} ${styles.rupesGrid}`}>
          {featured.map((product, index) => (
            <ProductCard
              eyebrow="RUPES"
              index={String(index + 1).padStart(2, "0")}
              key={product.slug}
              product={product}
            />
          ))}
        </div>
      ) : null}

      <div className={styles.productsFooter}>
        <p>
          Cene i stanje na lageru nisu javni — proveravaju se kroz upit.
        </p>
        <Link className={`${styles.secondaryButton} cs-cta`} data-cta-on="theme" href="/katalog?brend=rupes">
          Svi RUPES proizvodi ({products.length})
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
