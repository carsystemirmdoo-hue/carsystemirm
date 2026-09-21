import Image from "next/image";
import type { CarsystemBrand } from "@/lib/carsystem-data";
import styles from "@/components/brand/BrandLogoMark.module.css";

type BrandLogoMarkProps = {
  brand: Pick<CarsystemBrand, "name" | "logo" | "wordmark">;
  width: number;
  height: number;
  alt: string;
  className?: string;
  priority?: boolean;
  routeCritical?: boolean;
  /**
   * `onLight`: pločica je svetla u obe teme (hero čip, traka proizvođača), pa je tekst uvek taman.
   * Podrazumevano tekst nasleđuje boju okvira, koji prati temu.
   */
  tone?: "inherit" | "onLight";
};

/**
 * Logotip brenda, ili — kada odobren logo fajl ne postoji — neutralan tekstualni naziv.
 *
 * Tekstualni prikaz nije zamena za logotip i ne oponaša ga: isti sistemski font kao ostatak
 * sajta, bez boja i oblika brenda. Logo se ne preuzima sa interneta bez provere prava.
 */
export function BrandLogoMark({ brand, width, height, alt, className, priority, routeCritical, tone = "inherit" }: BrandLogoMarkProps) {
  if (!brand.logo) {
    return (
      <span className={styles.wordmark} data-brand-wordmark="text" data-tone={tone} aria-hidden={alt === "" ? true : undefined}>
        {brand.wordmark ?? brand.name}
      </span>
    );
  }

  return (
    <Image
      src={brand.logo}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      data-route-critical={routeCritical ? "true" : undefined}
    />
  );
}
