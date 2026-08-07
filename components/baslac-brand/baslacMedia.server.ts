import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  baslacMedia,
  type BaslacMediaAvailability,
} from "./baslacBrandData";

function publicAssetExists(src: string | undefined) {
  if (!src) return false;

  return existsSync(join(process.cwd(), "public", src.replace(/^\/+/, "")));
}

export function getBaslacMediaAvailability(): BaslacMediaAvailability {
  return Object.fromEntries(
    Object.values(baslacMedia).map((media) => [
      media.id,
      {
        desktop: publicAssetExists(media.desktopSrc),
        mobile: publicAssetExists(media.mobileSrc),
      },
    ]),
  ) as BaslacMediaAvailability;
}
