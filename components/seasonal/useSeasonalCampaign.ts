"use client";

import { useEffect, useState } from "react";
import {
  belgradeDateKey,
  isDateKey,
  parseSeasonalMode,
  resolveSeasonalCampaign,
  type ActiveSeasonalCampaign,
} from "@/lib/seasonal/seasonalCalendar.mjs";
import { seasonalCampaigns } from "@/lib/seasonal/seasonalCampaigns.config.mjs";

/**
 * Ručni prekidač za ceo sajt, upisuje se u build (`auto` | `off` | id kampanje).
 * Mora biti doslovno `process.env.NEXT_PUBLIC_…` da bi ga Next ugradio.
 */
const SITE_MODE = process.env.NEXT_PUBLIC_SEASONAL_CAMPAIGNS;

/**
 * Preview sa simuliranim datumom radi u developmentu, a u drugim buildovima
 * samo uz `NEXT_PUBLIC_SEASONAL_PREVIEW=1` (npr. zaštićen Preview deployment).
 */
const PREVIEW_ALLOWED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_SEASONAL_PREVIEW === "1";

export const SEASONAL_PREVIEW_DATE_PARAM = "sezona-datum";
export const SEASONAL_PREVIEW_MODE_PARAM = "sezona";

function readPreview(): { dateKey?: string; mode?: string } {
  if (!PREVIEW_ALLOWED) return {};
  const params = new URLSearchParams(window.location.search);
  const date = params.get(SEASONAL_PREVIEW_DATE_PARAM);
  const mode = params.get(SEASONAL_PREVIEW_MODE_PARAM);
  return {
    dateKey: date && isDateKey(date) ? date : undefined,
    mode: mode ?? undefined,
  };
}

/**
 * Aktivna sezonska kampanja, ili `null` za standardnu verziju.
 *
 * Stranice brendova su statičke (SSG), pa se sezona NE računa na serveru:
 * server i prvi klijentski render uvek daju standardnu verziju, a sezona se
 * određuje posle hidratacije iz lokalnog sata, preračunatog u Europe/Belgrade.
 * Tako se kampanja sama uključuje i gasi bez novog deploya.
 */
export function useSeasonalCampaign(): ActiveSeasonalCampaign | null {
  const [active, setActive] = useState<ActiveSeasonalCampaign | null>(null);

  useEffect(() => {
    const preview = readPreview();
    const mode = parseSeasonalMode(preview.mode ?? SITE_MODE, seasonalCampaigns);
    const dateKey = preview.dateKey ?? belgradeDateKey(new Date());
    setActive(resolveSeasonalCampaign({ campaigns: seasonalCampaigns, dateKey, mode }));
  }, []);

  return active;
}
