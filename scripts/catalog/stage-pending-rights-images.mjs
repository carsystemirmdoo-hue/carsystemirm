#!/usr/bin/env node
/**
 * Slike čije pravo objave vlasnik još nije potvrdio (`supplied-images.json` → `rightsBasis` ≠
 * `OWNER_CONFIRMED`) NE žive u `public/`. Izvedeni fajlovi su u `review-assets/pending-rights/`
 * (praćeno u Gitu, van javnog direktorijuma). Ovaj korak se pokreće pre `next build`:
 *
 *   - VERCEL_ENV=production → kopije u `public/` se BRIŠU i proverava se da ih nema; produkcioni
 *     deployment ih ne isporučuje ni stranicom ni direktnim URL-om;
 *   - lokalno / Preview      → kopiraju se u `public/` (folder je u .gitignore), da bi vlasnik
 *     mogao da ih pregleda.
 *
 * Runtime (`lib/supplied-image-rights.mjs`) ih na Production dodatno ne koristi.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RIGHTS_CONFIRMED } from "../../lib/supplied-image-rights.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PENDING_PUBLIC_SEGMENT = "/pending-rights/";

/** @param {{ root?: string, vercelEnv?: string }} [options] */
export function stagePendingRightsImages({ root = ROOT, vercelEnv = process.env.VERCEL_ENV } = {}) {
  const registry = JSON.parse(readFileSync(path.join(root, "data/catalog/image-supply/supplied-images.json"), "utf8"));
  const pending = registry.images.filter((image) => image.rightsBasis !== RIGHTS_CONFIRMED);
  const production = vercelEnv === "production";
  const result = { production, staged: [], removed: [] };
  if (production) {
    // Briše se CEO `public/products/*/pending-rights/`, ne samo stavke sa spiska — i zaostala kopija
    // zapisa koji je u međuvremenu preimenovan ili uklonjen iz registra ne sme da ode u Production.
    const productsDir = path.join(root, "public/products");
    for (const brand of existsSync(productsDir) ? readdirSync(productsDir) : []) {
      const dir = path.join(productsDir, brand, "pending-rights");
      if (!existsSync(dir)) continue;
      result.removed.push(...readdirSync(dir).map((name) => `/products/${brand}/pending-rights/${name}`));
      rmSync(dir, { recursive: true, force: true });
      if (existsSync(dir)) throw new Error(`${dir} i dalje postoji za Production build`);
    }
  }
  for (const image of pending) {
    if (!image.path.includes(PENDING_PUBLIC_SEGMENT)) throw new Error(`${image.imageId}: slika bez potvrđenog prava mora imati putanju pod ${PENDING_PUBLIC_SEGMENT}`);
    if (!image.stagedSource || image.stagedSource.startsWith("public/")) throw new Error(`${image.imageId}: stagedSource mora biti van public/`);
    const target = path.join(root, "public", image.path);
    if (production) {
      if (existsSync(target)) throw new Error(`${image.path} i dalje postoji u public/ za Production build`);
    } else {
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(path.join(root, image.stagedSource), target);
      result.staged.push(image.path);
    }
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = stagePendingRightsImages();
  console.log(`pending-rights: ${result.production ? `Production — u public/ nema slika bez potvrđenog prava (uklonjeno ${result.removed.length})` : `lokalno/Preview — postavljeno ${result.staged.length}`}`);
}
