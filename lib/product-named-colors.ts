/**
 * Typed access to the named/series colour table, the shade blocklist and the
 * Baslac swatch verification map. Data lives in `lib/productNamedColors.mjs`.
 */
import {
  BASLAC_SWATCH_VERIFICATION as VERIFICATION_IMPL,
  NAMED_COLOR_TOKENS as TOKENS_IMPL,
  PRODUCT_NAMED_COLORS as MAP_IMPL,
  PRODUCT_SHADE_BLOCKLIST as BLOCKLIST_IMPL,
  getProductNamedColor as getProductNamedColorImpl,
  getProductShadeBlockReason as getProductShadeBlockReasonImpl,
} from "@/lib/productNamedColors.mjs";

export type NamedColorToken = "white" | "light-grey" | "grey" | "dark-grey" | "black" | "yellow";

export type NamedColorEntry = {
  token?: NamedColorToken;
  color?: string;
  series?: string;
  source: string;
};

export type NamedColor = {
  color: string;
  token: NamedColorToken | null;
  series: string | null;
  source: string;
};

export type BaslacSwatchVerification =
  | "chart-45-2019-verified"
  | "chart-45-2019-group"
  | "not-in-chart-2019"
  | "chart-35-2024-verified"
  | "chart-35-2024-group"
  | "not-in-chart-35-2024"
  | "chart-30-verified"
  | "chart-30-group"
  | "transparent-not-shown"
  | "name-derived-no-chart";

export const NAMED_COLOR_TOKENS = TOKENS_IMPL as Readonly<Record<NamedColorToken, string>>;
export const PRODUCT_NAMED_COLORS = MAP_IMPL as Readonly<Record<string, NamedColorEntry>>;
export const PRODUCT_SHADE_BLOCKLIST = BLOCKLIST_IMPL as Readonly<Record<string, string>>;
export const BASLAC_SWATCH_VERIFICATION = VERIFICATION_IMPL as Readonly<
  Record<string, BaslacSwatchVerification>
>;

export function getProductNamedColor(product: {
  slug: string;
  manufacturerColor?: { color: string; token?: string; series?: string; source: string };
}): NamedColor | null {
  return getProductNamedColorImpl(product) as NamedColor | null;
}

export function getProductShadeBlockReason(product: { slug: string }): string | null {
  return getProductShadeBlockReasonImpl(product) as string | null;
}
