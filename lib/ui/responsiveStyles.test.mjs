import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/*
 * Podeljeni CSS (zajednički + .desktop + .mobile, 2026-10-22) sme da se uvozi SAMO kroz
 * `<ime>.styles.ts`. Kada neka komponenta direktno uveze zajednički fajl, Next ga može
 * učitati posle rasporeda i mobilno pravilo izgubi (desilo se na izboru baza).
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

test("podeljeni CSS se uvozi samo kroz <ime>.styles.ts", () => {
  const offenders = [];
  for (const file of [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))]) {
    if (file.endsWith(".styles.ts")) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+?)(\.desktop|\.mobile)?\.module\.css["']/g)) {
      const spec = match[1];
      const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(file), spec);
      if (match[2] || existsSync(`${base}.desktop.module.css`) || existsSync(`${base}.mobile.module.css`)) {
        offenders.push(`${path.relative(ROOT, file)} → ${match[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("svaki podeljen CSS ima svoj .styles.ts", () => {
  const dirs = ["components/catalog", "components/product/family", "components/layout"];
  for (const dir of dirs) {
    for (const name of readdirSync(path.join(ROOT, dir))) {
      const m = name.match(/^(.+)\.(desktop|mobile)\.module\.css$/);
      if (!m) continue;
      assert.ok(existsSync(path.join(ROOT, dir, `${m[1]}.styles.ts`)), `${dir}/${m[1]}.styles.ts`);
    }
  }
});
