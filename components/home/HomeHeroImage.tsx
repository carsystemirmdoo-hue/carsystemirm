"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  observeSiteTheme,
  readSiteTheme,
} from "@/components/map/carsystem-map-style";
import { HOME_HERO_ASSETS } from "@/lib/site-access-handoff";

type SiteTheme = keyof typeof HOME_HERO_ASSETS;

export function HomeHeroImage({ className }: { className: string }) {
  const [theme, setTheme] = useState<SiteTheme | null>(null);

  useEffect(() => {
    setTheme(readSiteTheme());
    return observeSiteTheme(setTheme);
  }, []);

  if (!theme) return null;

  return (
    <Image
      alt=""
      className={className}
      data-route-critical="true"
      fill
      fetchPriority="high"
      loading="eager"
      priority
      sizes="(min-width: 2625px) 1680px, (min-width: 1700px) 64vw, (min-width: 1600px) 1088px, (max-width: 860px) 100vw, 68vw"
      src={HOME_HERO_ASSETS[theme]}
      unoptimized
    />
  );
}
