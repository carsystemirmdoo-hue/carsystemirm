"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { ProductHeroSprayBackdrop } from "@/components/product/ProductHeroSprayBackdrop";
import { PuttyMaterialTrace } from "@/components/product/PuttyMaterialTrace";
import { useProductImageLoadState } from "@/components/product/useProductImageLoadState";
import { useProductVariant } from "@/components/product/ProductVariantProvider";
import type { ProductStageFormat } from "@/components/product/productStageImages";
import {
  PUTTY_MATERIAL_TRACE_OPTICAL_Y,
  PUTTY_MATERIAL_TRACE_PRODUCT_ENVELOPE,
  PUTTY_MATERIAL_TRACE_STAGE_ASPECT,
} from "@/lib/putty-material-trace";
import fit from "./ProductImageFit.generated.module.css";
import styles from "./ProductDetailExperience.module.css";

/**
 * The PDP product stage.
 *
 * Five layers, in a fixed order, each owning exactly one job:
 *
 *   0 surface — a neutral stage plate, so the panel is an object rather than a
 *               hole in the page;
 *   1 art     — decoration, drawn in a tone chosen against the product's
 *               measured lightness (see `contrastMode`);
 *   2 halo    — a soft separation pass, only where the product would otherwise
 *               merge into the art;
 *   3 product — the render itself, fitted by its own content box;
 *   4 ui      — brand mark, quantity, gallery index, zoom.
 *
 * The product layer never depends on the height of the page's right column and
 * never moves when a UI control appears: the stage owns a fixed aspect ratio,
 * and the product is centred inside it by its own silhouette.
 */
export function ProductStickyStage({
  brandName,
  stageFormat,
}: {
  brandName: string;
  /**
   * Format panela je NAMERNO na nivou porodice, ne varijante.
   *
   * Isti razlog zbog kog se format ne menja po slici u galeriji: menjanje okvira
   * dok korisnik bira boju pomerilo bi stranu pod njim. Boja, slika i mere
   * proizvoda prate varijantu; proporcija panela je zaključana.
   */
  stageFormat: ProductStageFormat;
}) {
  const { activeVariant, interactive } = useProductVariant();
  const images = activeVariant.images;

  const [gallery, setGallery] = useState({ key: activeVariant.key, index: 0 });
  // Izbor slike u galeriji pripada varijanti. Kada se varijanta promeni, indeks
  // se vraća na glavnu sliku — bez efekta, jer bi efekat prvo iscrtao pogrešnu
  // sliku pa je tek onda ispravio.
  const activeIndex = gallery.key === activeVariant.key ? gallery.index : 0;
  const setActiveIndex = (index: number) =>
    setGallery({ key: activeVariant.key, index });
  const [isZoomed, setIsZoomed] = useState(false);
  const activeImage = images[activeIndex] ?? null;
  /*
   * Slika koja ne uspe da se učita ne sme da ostavi prazan kadar ni slomljenu
   * ikonu: scena prelazi u isti pošten prikaz kao proizvod bez slike
   * („Vizuel u pripremi"). Dok se učitava, kadar zadržava svoj izgled.
   */
  const { ref: imageRef, state: imageState } = useProductImageLoadState(activeImage?.src);
  const shownImage = imageState === "error" ? null : activeImage;

  /*
   * Kratak crossfade se pali SAMO na izbor napravljen na strani.
   *
   * Prva slika je `priority` i nosi LCP strane; animacija neprozirnosti na njoj
   * bi odložila najveće iscrtavanje. Zato prelaz ćuti pri učitavanju, na
   * direktnom `?varijanta=` linku i na Back/Forward — a radi kada korisnik
   * klikne ili izabere tastaturom, gde promena i treba da bude vidljiva.
   */
  const crossfade = interactive;

  /*
   * Trag kita se prikazuje samo proizvodima sa odobrenom geometrijom — po
   * stabilnom slugu, nikad po nazivu. Kad je uključen, panel drži 4:3 i na
   * mobilnom, a envelope proizvoda se spušta na 39cqw da bi materijal ostao
   * vidljiv sa sve četiri strane limenke.
   */
  const puttyTrace = activeVariant.puttyTrace;
  const showPuttyTrace = puttyTrace !== null;
  /*
   * Promenljive idu na SPOLJNI wrapper, ne na `.stage`: custom properties se
   * nasleđuju, inline deklaracija tuče i media query koji na mobilnom vraća
   * panel na 1:1, a `.stage` zadržava svoj postojeći `style` izraz netaknut —
   * scena sprejeva i boja se ne dodiruje.
   */
  const puttyStyle: CSSProperties | undefined = showPuttyTrace
    ? ({
        "--product-stage-aspect": PUTTY_MATERIAL_TRACE_STAGE_ASPECT,
        "--product-envelope-w": PUTTY_MATERIAL_TRACE_PRODUCT_ENVELOPE,
        "--product-optical-y": PUTTY_MATERIAL_TRACE_OPTICAL_Y,
      } as CSSProperties)
    : undefined;

  /*
   * Fotografija na ravnoj studijskoj pozadini (`matte: "backdrop"`) u tamnoj
   * temi dobija ploču u SVOJOJ boji pozadine — vidi
   * `lib/product-image-metrics.ts` → `resolveImageMatte`. Promenljiva ide na
   * samu ploču, pa `.stage` zadržava svoj postojeći `style` izraz.
   */
  const plateStyle: CSSProperties | undefined = shownImage?.backdrop
    ? ({ "--product-image-backdrop": shownImage.backdrop } as CSSProperties)
    : undefined;

  return (
    <div
      className={styles.stickyStage}
      data-product-stage-treatment={activeVariant.treatment}
      data-product-stage-type={activeVariant.productType}
      data-product-stage-spray={activeVariant.hasSprayBackdrop ? "true" : "false"}
      data-product-size-class={activeVariant.sizeClass}
      data-stage-format={stageFormat}
      data-product-has-image={shownImage ? "true" : "false"}
      data-putty-trace={showPuttyTrace ? "true" : undefined}
      style={puttyStyle}
    >
      <div
        className={`${styles.stage} ${fit.fit}`}
        data-product-hero-visual
        data-cursor="image"
        data-product-contrast={activeImage?.contrastMode ?? "balanced"}
        data-product-zoom={isZoomed ? "true" : "false"}
        data-product-fit={activeImage?.src}
        data-product-image-matte={shownImage?.matte}
        data-product-image-state={activeImage ? imageState : undefined}
        style={activeVariant.style}
      >
        <span className={styles.stagePlate} style={plateStyle} aria-hidden="true" />
        {activeVariant.hasSprayBackdrop ? <ProductHeroSprayBackdrop /> : null}
        {showPuttyTrace ? (
          <PuttyMaterialTrace config={puttyTrace} />
        ) : null}
        <span className={styles.stageHalo} aria-hidden="true" />

        <span className={styles.heroProductObject}>
          {activeImage && shownImage ? (
            <Image
              ref={imageRef}
              /*
               * Ključ nosi identitet VARIJANTE, ne samo adresu slike.
               *
               * Crossfade je CSS animacija na `data-variant-crossfade="true"`.
               * Ta zastavica ostaje uključena posle prvog izbora, pa se
               * animacija ponovo pokreće samo ako se čvor iznova montira.
               * Dok je ključ bio isključivo `activeImage.src`, remount je
               * zavisio od SADRŽAJA: dve varijante koje dele isti packshot
               * (porodice po pakovanju, `packshotKind: "family"`) dobile bi
               * prelaz jednom i nikad više. Ponašanje ne sme da zavisi od toga
               * da li se dve slike slučajno razlikuju.
               *
               * Slika ostaje u ključu da bi se i promena unutar galerije iste
               * varijante i dalje ponašala kao i do sada.
               *
               * Ovo NE remontira ni providera ni PDP — menja se ključ jednog
               * `<Image>` čvora. Prvo učitavanje i Back/Forward i dalje ćute,
               * jer tada `interactive` stoji na `false` i atributa nema.
               */
              key={`${activeVariant.key}:${activeImage.src}`}
              src={activeImage.src}
              alt={activeImage.alt}
              data-route-critical="true"
              data-variant-crossfade={crossfade ? "true" : undefined}
              fill
              priority
              sizes="(min-width: 1180px) 32vw, (min-width: 896px) 34vw, 94vw"
              className={styles.heroProductImage}
            />
          ) : (
            <span className={styles.heroProductFallback} aria-hidden="true">
              <small>Vizuel u pripremi</small>
              <strong>{brandName}</strong>
              <span>{activeVariant.name}</span>
            </span>
          )}
        </span>

        <span className={styles.heroBrandMark}>{brandName}</span>
        {images.length > 1 ? (
          <span className={styles.galleryIndex} aria-hidden="true">
            {`${String(activeIndex + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`}
          </span>
        ) : null}

        {/* Quantity is shown only when `lib/product-scale.ts` could confirm it
            from real package data — an unknown volume renders no badge at all
            rather than a guessed one. */}
        {activeVariant.quantityLabel ? (
          <span className={styles.quantityBadge} data-status={activeVariant.volumeStatus}>
            <span className={styles.quantityBadgeRule} aria-hidden="true" />
            {activeVariant.quantityLabel}
          </span>
        ) : null}

        {shownImage ? (
          <button
            className={styles.zoomControl}
            type="button"
            aria-pressed={isZoomed}
            aria-label={
              isZoomed
                ? "Vrati prikaz proizvoda na osnovnu veličinu"
                : "Uvećaj prikaz proizvoda"
            }
            onClick={() => setIsZoomed((zoomed) => !zoomed)}
          >
            <ZoomIcon zoomed={isZoomed} />
          </button>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className={styles.galleryThumbs} aria-label="Izaberite prikaz proizvoda">
          {images.map((image, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                className={`${styles.galleryThumb} ${fit.fit}`}
                data-active={isActive || undefined}
                data-product-fit={image.src}
                data-product-image-matte={image.matte}
                style={
                  image.backdrop
                    ? ({ "--product-image-backdrop": image.backdrop } as CSSProperties)
                    : undefined
                }
                type="button"
                aria-label={`Prikaži sliku ${index + 1}: ${image.alt}`}
                aria-pressed={isActive}
                onClick={() => setActiveIndex(index)}
                key={image.src}
              >
                <GalleryThumbImage src={image.src} priority={index === 0} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Sličica koja ne uspe da se učita ostaje prazna pločica, bez slomljene ikone. */
function GalleryThumbImage({ src, priority }: { src: string; priority: boolean }) {
  const { ref, state } = useProductImageLoadState(src);
  if (state === "error") return null;
  return (
    <Image
      ref={ref}
      src={src}
      alt=""
      fill
      priority={priority}
      sizes="5rem"
      className={styles.galleryThumbImage}
    />
  );
}

function ZoomIcon({ zoomed }: { zoomed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.4 10.4 14 14" />
      <path d="M4.8 7h4.4" />
      {zoomed ? null : <path d="M7 4.8v4.4" />}
    </svg>
  );
}
