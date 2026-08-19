"use client";

/**
 * Jedna instanca panela pretrage za ceo javni sajt.
 *
 * Header i Homepage ne drže svaki svoj panel: obe kontrole zovu `openSearch()`
 * iz ovog konteksta, pa postoji tačno jedan dijalog, jedan set globalnih
 * prečica i jedan životni ciklus fokusa. Provider je montiran u
 * `PublicSiteChrome`, iznad i Headera i sadržaja stranice.
 *
 * Panel se montira tek pri prvom otvaranju (`opened`): dok korisnik nije
 * pokazao nameru da pretražuje, ne postoji ni komponenta koja bi mogla da
 * povuče search asset.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ProductSearchDialog } from "@/components/search/ProductSearchDialog";

type ProductSearchContextValue = {
  open: boolean;
  /** `trigger` je kontrola na koju se fokus vraća pri zatvaranju. */
  openSearch: (trigger?: HTMLElement | null) => void;
  closeSearch: () => void;
};

const ProductSearchContext = createContext<ProductSearchContextValue | null>(null);

/**
 * Prečica se ne sme presresti dok korisnik kuca.
 *
 * `Cmd/Ctrl + K` se hvata svuda osim u editabilnom polju (tamo je često
 * prečica same platforme za brisanje reda), a goli `/` isključivo van polja —
 * inače bi kosa crta u nazivu proizvoda otvarala pretragu umesto da se otkuca.
 */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function ProductSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openSearch = useCallback((trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    setOpened(true);
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isTypingTarget(event.target) && !open) return;
        event.preventDefault();
        if (open) setOpen(false);
        else openSearch(document.activeElement as HTMLElement | null);
        return;
      }

      if (event.key === "/" && !open && !isTypingTarget(event.target)) {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        openSearch(document.activeElement as HTMLElement | null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, openSearch]);

  const value = useMemo(
    () => ({ open, openSearch, closeSearch }),
    [closeSearch, open, openSearch],
  );

  return (
    <ProductSearchContext.Provider value={value}>
      {children}
      {opened ? (
        <ProductSearchDialog
          open={open}
          onClose={closeSearch}
          returnFocusTo={triggerRef.current}
        />
      ) : null}
    </ProductSearchContext.Provider>
  );
}

/**
 * Kontrole koje otvaraju pretragu.
 *
 * Vraća `null`-safe objekat i van providera (portal, interaction-demo rute
 * nemaju javni chrome), pa Header i Homepage ne moraju da znaju gde su
 * montirani.
 */
export function useProductSearchDialog(): ProductSearchContextValue {
  return useContext(ProductSearchContext) ?? DETACHED;
}

/** Stabilna identičnost, da potrošači van providera ne re-renderuju bez razloga. */
const DETACHED: ProductSearchContextValue = {
  open: false,
  openSearch: () => {},
  closeSearch: () => {},
};
