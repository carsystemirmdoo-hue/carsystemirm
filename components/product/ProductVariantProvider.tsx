"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProductVariantView } from "@/components/product/productVariantView";
import {
  findVariantByKey,
  resolveActiveVariant,
  toCartPayload,
  variantInquiryHref,
  variantQueryValue,
  VARIANT_QUERY_PARAM,
} from "@/components/product/productVariantState.mjs";

type ProductVariantContextValue = {
  /** Sve varijante porodice, u katalogu redosledu. */
  variants: ProductVariantView[];
  /** Trenutno izabrana varijanta. Nikada `null` kada porodica ima varijante. */
  activeVariant: ProductVariantView;
  activeKey: string;
  /**
   * Da li je tekući izbor napravljen klikom/tastaturom na ovoj strani.
   *
   * `false` je i prvo iscrtavanje i usklađivanje sa adresom (direktan link,
   * Back/Forward). Scena time zna kada sme da pusti prelaz: pri učitavanju bi
   * animacija neprozirnosti pala na LCP sliku.
   */
  interactive: boolean;
  /** Menja izbor. `push` = nov unos u istoriji; `false` samo prepisuje tekući. */
  selectVariant: (variant: ProductVariantView, push?: boolean) => void;
  /**
   * Varijanta po bilo kojoj njenoj oznaci (ključ, id, šifra ili slug), ili
   * `null`. Selektor time preslikava svoj red na varijantu bez pretpostavke o
   * tome koje polje oba modela dele.
   */
  findVariant: (key: string | null | undefined) => ProductVariantView | null;
  /** Adresa upita za aktivnu varijantu. */
  inquiryHref: string;
  /** Stavka za portal korpu, bez cene. `null` kada varijanta nema identitet. */
  cartPayload: ReturnType<typeof toCartPayload>;
};

const ProductVariantContext = createContext<ProductVariantContextValue | null>(
  null,
);

/**
 * Jedini runtime vlasnik izabrane varijante na PDP-u.
 *
 * Ranije je izbor živeo u lokalnom `useState` unutar selektora, pa ga nijedan
 * drugi deo strane nije mogao pročitati: naslov, šifra, slika i grafit su
 * ostajali vezani za varijantu koju je izabrao server. Ovde je isti izbor
 * podignut na najniži zajednički nivo svih potrošača.
 *
 * Server i dalje bira reprezentativnu varijantu i renderuje je — prvi render na
 * klijentu je identičan, pa nema razlike pri hidrataciji. Tek posle montiranja
 * se `?varijanta=` iz adrese usklađuje sa izborom.
 */
export function ProductVariantProvider({
  children,
  initialKey,
  inquiryBasePath = "/kontakt",
  variants,
}: {
  children: ReactNode;
  /** Ključ varijante koju je server izabrao i renderovao. */
  initialKey: string;
  inquiryBasePath?: string;
  variants: ProductVariantView[];
}) {
  const [activeKey, setActiveKey] = useState(initialKey);
  const [interactive, setInteractive] = useState(false);

  const activeVariant = useMemo(
    () =>
      resolveActiveVariant(variants, activeKey, initialKey) as ProductVariantView,
    [activeKey, initialKey, variants],
  );

  const writeUrl = useCallback((variant: ProductVariantView, push: boolean) => {
    // History API namerno umesto `router.push`/`<Link>`: promena varijante nije
    // navigacija. Ovim se ne pravi ni document ni RSC zahtev, a pozicija
    // skrola ostaje netaknuta jer se ruta ne menja.
    const url = new URL(window.location.href);
    url.searchParams.set(VARIANT_QUERY_PARAM, variantQueryValue(variant));
    const state = { [VARIANT_QUERY_PARAM]: variant.key };
    if (push) window.history.pushState(state, "", url);
    else window.history.replaceState(state, "", url);
  }, []);

  const selectVariant = useCallback(
    (variant: ProductVariantView, push = true) => {
      if (!variant) return;
      setActiveKey(variant.key);
      setInteractive(true);
      if (typeof window !== "undefined") writeUrl(variant, push);
    },
    [writeUrl],
  );

  const findVariant = useCallback(
    (key: string | null | undefined) =>
      findVariantByKey(variants, key) as ProductVariantView | null,
    [variants],
  );

  /**
   * Usklađivanje sa adresom — pri montiranju i na Back/Forward.
   *
   * Direktan link (`?varijanta=CL-810`) se primenjuje ovde, posle hidratacije.
   * Strana je statički generisana, pa server ne vidi upit; ovo je jedino mesto
   * na kome se on sme pročitati bez razlike u hidrataciji.
   */
  useEffect(() => {
    const applyFromUrl = () => {
      const requested = new URLSearchParams(window.location.search).get(
        VARIANT_QUERY_PARAM,
      );
      const resolved = resolveActiveVariant(
        variants,
        requested,
        initialKey,
      ) as ProductVariantView | null;
      if (!resolved) return;
      setActiveKey(resolved.key);
      // Usklađivanje sa adresom nije izbor na strani: ni prvo iscrtavanje ni
      // Back/Forward ne smeju da pokrenu prelaz.
      setInteractive(false);
    };

    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, [initialKey, variants]);

  const value = useMemo<ProductVariantContextValue>(() => {
    const inquiryHref = variantInquiryHref(
      `${inquiryBasePath}?tema=proizvod&proizvod=${activeVariant.slug}`,
      activeVariant,
    );

    return {
      variants,
      activeVariant,
      activeKey: activeVariant.key,
      interactive,
      selectVariant,
      findVariant,
      inquiryHref,
      cartPayload: toCartPayload({
        ...activeVariant,
        image: activeVariant.images[0]?.src ?? null,
      }),
    };
  }, [activeVariant, findVariant, inquiryBasePath, interactive, selectVariant, variants]);

  return (
    <ProductVariantContext.Provider value={value}>
      {children}
    </ProductVariantContext.Provider>
  );
}

/**
 * Aktivna varijanta i njena izmena.
 *
 * Baca kada se pozove van providera — potrošač koji čita varijantu, a nije pod
 * njim, tiho bi prikazivao zastarele podatke. To je upravo greška zbog koje je
 * ovaj kontekst i uveden.
 */
export function useProductVariant(): ProductVariantContextValue {
  const context = useContext(ProductVariantContext);
  if (!context) {
    throw new Error(
      "useProductVariant mora biti unutar <ProductVariantProvider>.",
    );
  }
  return context;
}

/**
 * Varijanta kada provider možda nije montiran.
 *
 * Postoji zbog površina koje se koriste i van PDP-a (kartice u katalogu), gde
 * pojam „aktivne varijante" ne postoji.
 */
export function useOptionalProductVariant(): ProductVariantContextValue | null {
  return useContext(ProductVariantContext);
}
