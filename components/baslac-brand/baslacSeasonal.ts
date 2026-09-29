import type { ActiveSeasonalCampaign } from "@/lib/seasonal/seasonalCalendar.mjs";
import type {
  BaslacCampaignSlide,
  BaslacHeroSlide,
  BaslacSeasonalSlide,
} from "./baslacBrandData";

/**
 * Sezonski slajd ide POSLE prvog brend slajda: h1 stranice i LCP slika ostaju
 * brend sadržaj, a praznični pozdrav se pojavljuje u prvom autoplay ciklusu.
 */
export const BASLAC_SEASONAL_SLIDE_INDEX = 1;

const SEASON_PALETTE = {
  winter: { from: "#060d10", to: "#1c2f45", progress: "#d9b872" },
  spring: { from: "#060d10", to: "#1e4a3f", progress: "#8fd3a8" },
} as const;

export function toBaslacSeasonalSlide(
  active: ActiveSeasonalCampaign,
): BaslacSeasonalSlide {
  const { campaign, image } = active;
  const palette = SEASON_PALETTE[campaign.theme];

  return {
    id: `seasonal-${campaign.id}`,
    visual: "seasonal",
    season: campaign.theme,
    image: image
      ? {
          desktopSrc: image.desktopSrc,
          mobileSrc: image.mobileSrc ?? image.desktopSrc,
          width: image.width,
          height: image.height,
          mobileWidth: image.mobileWidth ?? image.width,
          mobileHeight: image.mobileHeight ?? image.height,
        }
      : null,
    imageAlt: image?.alt ?? `Dekorativna sezonska pozadina — ${campaign.label}`,
    eyebrow: campaign.copy.eyebrow,
    title: campaign.copy.title,
    description: campaign.copy.description,
    primaryCta: campaign.copy.cta,
    controlLabel: campaign.copy.controlLabel,
    transitionFrom: palette.from,
    transitionTo: palette.to,
    progressColor: palette.progress,
    controlTheme: "on-dark",
  };
}

/** Standardni slajdovi ostaju netaknuti; sezonski se samo umeće. */
export function withBaslacSeasonalSlide(
  slides: readonly BaslacCampaignSlide[],
  active: ActiveSeasonalCampaign | null,
): BaslacHeroSlide[] {
  if (!active) return [...slides];
  const index = Math.min(BASLAC_SEASONAL_SLIDE_INDEX, slides.length);
  return [
    ...slides.slice(0, index),
    toBaslacSeasonalSlide(active),
    ...slides.slice(index),
  ];
}
