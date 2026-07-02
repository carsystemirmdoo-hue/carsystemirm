import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import { getBrandBySlug, getCategoryBySlug } from "@/lib/products";
import { Button } from "@/components/ui/Button";

export function ProductDetail({ product }: { product: Product }) {
  const brand = getBrandBySlug(product.brand);
  const category = getCategoryBySlug(product.category);
  const images = [product.image, ...product.gallery];

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-surface-muted">
          <Image
            src={images[0].url}
            alt={images[0].alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain p-10"
            priority
          />
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            {images.slice(1).map((image) => (
              <div
                key={image.url}
                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-muted"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="25vw"
                  className="object-contain p-3"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {brand && (
            <Link href={`/brendovi/${brand.slug}`} className="hover:text-foreground">
              {brand.name}
            </Link>
          )}
          {brand && category && <span aria-hidden="true">·</span>}
          {category && (
            <Link href="/katalog" className="hover:text-foreground">
              {category.name}
            </Link>
          )}
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          {product.name}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        {product.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {product.documents.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-foreground">Dokumentacija</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {product.documents.map((doc) => (
                <li key={doc.url}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
                  >
                    {doc.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10">
          <Button href={`/kontakt?tema=proizvod&proizvod=${product.slug}`}>
            Pošaljite upit
          </Button>
        </div>
      </div>
    </div>
  );
}
