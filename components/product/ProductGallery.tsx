import Image from "next/image";
import { ProductHeroSprayBackdrop } from "@/components/product/ProductHeroSprayBackdrop";
import type { CarsystemBrand, CarsystemProduct } from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import { getProductVisualStyle } from "@/components/product/productMotion";
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
        <div
          className={styles.heroVisualSurface}
          data-product-hero-visual
          data-cursor="image"
          style={getProductVisualStyle(product)}
        >
          <ProductHeroSprayBackdrop />
          <span className={styles.heroBrandMark}>{brand.name}</span>
          <span className={styles.heroProductObject}>
            {primaryImage ? (
              <Image
                src={primaryImage.src}
                alt={primaryImage.alt}
                fill
                sizes="(min-width: 1180px) 38vw, (min-width: 768px) 70vw, 86vw"
                className={styles.heroProductImage}
                priority
              />
            ) : (
              <span className={styles.heroProductFallback} aria-hidden="true">
                <small>Vizuel u pripremi</small>
                <strong>{brand.name}</strong>
                <span>{product.name}</span>
              </span>
            )}
          </span>
        </div>
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
