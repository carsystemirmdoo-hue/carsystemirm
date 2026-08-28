/**
 * Minimalno PNG citanje bez zavisnosti.
 *
 * Postoji zato sto se provera crvenih vertikalnih linija i pozicije grafita ne
 * sme svesti na CSS pretragu — moraju se gledati stvarno renderovani pikseli.
 * Podrzan je samo izlaz koji Chrome daje za screenshot: 8-bitni RGB ili RGBA,
 * bez interlacea.
 *
 * @typedef {{ width: number, height: number, channels: number, data: Buffer }} Raster
 */
import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * @param {Buffer} buffer sadrzaj PNG fajla
 * @returns {Raster}
 */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("nije PNG");

  let offset = 8;
  let header = null;
  const parts = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === "IDAT") {
      parts.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (!header) throw new Error("PNG bez IHDR");
  if (header.depth !== 8) throw new Error(`nepodrzana bit depth ${header.depth}`);
  if (header.interlace !== 0) throw new Error("interlaced PNG nije podrzan");

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType];
  if (!channels) throw new Error(`nepodrzan color type ${header.colorType}`);

  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);

  /* Obrnuti PNG filtere red po red; prethodni red je vec odfiltriran. */
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y === 0 ? null : out.subarray((y - 1) * stride, y * stride);

    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) {
        throw new Error(`nepoznat filter ${filter}`);
      }
      cur[i] = value & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

/**
 * Da li je piksel jasno crven, a ne samo topao.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function isRed(r, g, b) {
  return r > 110 && r > g * 1.7 && r > b * 1.7;
}

/**
 * Broji crvene piksele u koloni i najduzi neprekidan crveni niz.
 *
 * @param {Raster} raster
 * @param {number} x
 */
export function redColumn(raster, x) {
  const { height, channels, data, width } = raster;
  const col = Math.min(Math.max(Math.round(x), 0), width - 1);
  let count = 0;
  let run = 0;
  let longest = 0;

  for (let y = 0; y < height; y += 1) {
    const i = (y * width + col) * channels;
    if (isRed(data[i], data[i + 1], data[i + 2])) {
      count += 1;
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  return { x: col, count, longest, ratio: count / height };
}

/**
 * Trazi svaku kolonu u kojoj crveni pikseli zauzimaju vise od `threshold`
 * visine — to je potpis vertikalne linije kroz viewport.
 *
 * @param {Raster} raster
 * @param {number} [threshold]
 */
export function redVerticals(raster, threshold = 0.4) {
  const found = [];
  for (let x = 0; x < raster.width; x += 1) {
    const column = redColumn(raster, x);
    if (column.ratio > threshold) found.push(column);
  }
  return found;
}
