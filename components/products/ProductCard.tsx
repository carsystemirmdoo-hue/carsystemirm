import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/product";
import { getBrandBySlug, getCategoryBySlug } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const brand = getBrandBySlug(product.brand);
  const category = getCategoryBySlug(product.category);

  return (
    <Link
      href="/katalog"
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
        <Image
          src={product.image.url}
          alt={product.image.alt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {brand && <span>{brand.name}</span>}
          {brand && category && <span aria-hidden="true">·</span>}
          {category && <span>{category.name}</span>}
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {product.shortDescription}
        </p>
      </div>
    </Link>
  );
}
