import type { CarsystemBrand, CarsystemProduct } from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import styles from "./ProductDetailPage.module.css";

export function ProductGallery({
  product,
  brand,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
}) {
  const primaryImage = product.productImage ?? product.galleryImages[0] ?? null;
  const thumbnails = [primaryImage, ...product.galleryImages]
    .filter((image): image is NonNullable<typeof image> => Boolean(image))
    .filter((image) => !image.src.includes("placeholder-product"))
    .slice(0, 3);

  return (
    <div className={styles.gallery}>
      <div className={styles.stage}>
        <ProductVisualSurface
          brandName={brand.name}
          className={styles.heroVisualSurface}
          image={primaryImage}
          priority
          product={product}
          sizes="(min-width: 1180px) 38vw, (min-width: 768px) 70vw, 86vw"
        />
      </div>

      {thumbnails.length > 1 && (
        <div className={styles.thumbnailRail} aria-label="Galerija proizvoda">
          {thumbnails.map((image, index) => (
            <div
              className={`${styles.thumbnail} cs-image-surface`}
              key={`${image.src}-${index}`}
              data-cursor="image"
              data-motion-surface
            >
              <ProductVisualSurface
                brandName={brand.name}
                className={styles.thumbnailVisualSurface}
                image={image}
                product={product}
                sizes="(min-width: 768px) 12vw, 30vw"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
