#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const projectRoot = process.cwd();
const sourcePath = path.join(
  projectRoot,
  "data/rm-imported-products.generated.json",
);
const outputDirectory = path.join(
  projectRoot,
  "public/images/og/products/rm",
);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maximum = 14) {
  const words = value.trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maximum && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function categoryLabel(category) {
  const labels = {
    additive: "ADITIV",
    basecoat: "BAZNA BOJA",
    bodyfiller: "KIT",
    cleaner: "ČISTAČ",
    clearcoat: "BEZBOJNI LAK",
    hardener: "UČVRŠĆIVAČ",
    "polishing-compound": "POLIRANJE",
    "primer-filler": "PRAJMER I PUNILAC",
    thinner: "RAZREĐIVAČ",
  };
  return labels[category] ?? "R-M PROIZVOD";
}

function textOverlay(product) {
  const lines = wrapText(product.canonicalName);
  const lineMarkup = lines
    .map(
      (line, index) =>
        `<tspan x="76" dy="${index === 0 ? 0 : 64}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  const context =
    product.content?.context && product.content.context !== "R-M"
      ? product.content.context
      : "R-M";

  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#17191d"/>
      <path d="M0 0h16v630H0z" fill="#e5322a"/>
      <path d="M620 0h580v630H620z" fill="#24272c"/>
      <g opacity=".16" stroke="#8d929b">
        <path d="M660 0v630M740 0v630M820 0v630M900 0v630M980 0v630M1060 0v630M1140 0v630"/>
        <path d="M620 70h580M620 150h580M620 230h580M620 310h580M620 390h580M620 470h580M620 550h580"/>
      </g>
      <text x="76" y="82" fill="#e5322a" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="4">R-M · ${escapeXml(context.toUpperCase())}</text>
      <text x="76" y="174" fill="#f6f4f3" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" letter-spacing="-1">${lineMarkup}</text>
      <text x="76" y="490" fill="#c7c8cc" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="3">${escapeXml(categoryLabel(product.taxonomy.category))}</text>
      <path d="M76 528h472" stroke="#42464d"/>
      <text x="76" y="570" fill="#f6f4f3" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700">Carsystem i R-M</text>
      <text x="548" y="570" fill="#8d929b" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18">PROVERITE DOSTUPNOST</text>
    </svg>
  `);
}

async function main() {
  const data = JSON.parse(await readFile(sourcePath, "utf8"));
  await mkdir(outputDirectory, { recursive: true });

  for (const product of data.products) {
    const imagePath = path.join(
      projectRoot,
      "public",
      product.image.src.replace(/^\//, ""),
    );
    const productImage = await sharp(imagePath)
      .trim({ threshold: 12 })
      .resize(490, 500, {
        fit: "contain",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    await sharp(textOverlay(product))
      .composite([
        {
          input: productImage,
          gravity: "southeast",
          left: 675,
          top: 62,
        },
      ])
      .jpeg({
        quality: 90,
        chromaSubsampling: "4:4:4",
      })
      .toFile(path.join(outputDirectory, `${product.slug}.jpg`));
  }

  process.stdout.write(
    `Generisano ${data.products.length} R-M OG slika (1200×630) u ${path.relative(projectRoot, outputDirectory)}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
