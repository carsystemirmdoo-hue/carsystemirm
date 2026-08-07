import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  carsystemMedia,
  type CarsystemMediaAvailability,
} from "./carsystemBrandData";

function publicAssetExists(src: string | undefined) {
  if (!src) return false;

  return existsSync(join(process.cwd(), "public", src.replace(/^\/+/, "")));
}

export function getCarsystemMediaAvailability(): CarsystemMediaAvailability {
  return Object.fromEntries(
    Object.values(carsystemMedia).map((media) => [
      media.id,
      {
        desktop: publicAssetExists(media.desktopSrc),
        mobile: publicAssetExists(media.mobileSrc),
      },
    ]),
  ) as CarsystemMediaAvailability;
}
