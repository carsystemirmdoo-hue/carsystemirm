import Image from "next/image";
import type { CarsystemBrand, CarsystemProduct } from "@/lib/carsystem-data";
import styles from "./ProductDetailPage.module.css";

export function ProductGallery({
  product,
  brand,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
}) {
  const primaryImage = product.productImage ?? product.galleryImages[0] ?? null;
  const usesStructuredShot =
    !primaryImage || primaryImage.src.includes("placeholder-product");
  const thumbnails = [primaryImage, ...product.galleryImages]
    .filter((image): image is NonNullable<typeof image> => Boolean(image))
    .filter((image) => !image.src.includes("placeholder-product"))
    .slice(0, 3);

  return (
    <div className={styles.gallery}>
      <div className={styles.stage}>
        <span className={styles.stageBackdrop} aria-hidden="true" />
        {usesStructuredShot ? (
          <StructuredProductShot product={product} brand={brand} />
        ) : primaryImage ? (
          <div className={`${styles.imageFrame} cs-image-surface`} data-cursor="image" data-motion-surface>
            <Image
              src={primaryImage.src}
              alt={primaryImage.alt}
              fill
              sizes="(min-width: 1180px) 38vw, (min-width: 768px) 70vw, 86vw"
              className={styles.productImage}
              priority
            />
          </div>
        ) : (
          <StructuredProductShot product={product} brand={brand} />
        )}
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
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 768px) 12vw, 30vw"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StructuredProductShot({
  product,
  brand,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
}) {
  return (
    <div
      className={`${styles.productShot} cs-image-surface`}
      role="img"
      aria-label={product.name}
      data-cursor="image"
      data-motion-surface
    >
      <span className={styles.productShotType}>PRODUCT SHOT</span>
      <strong>{brand.name}</strong>
      <span>{product.name}</span>
      <em>studio · seamless grey</em>
    </div>
  );
}
