import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Svaka vrsta obaveštenja iz enuma ima čitljiv naziv. Bez naziva ekran
 * Obaveštenja prikazuje sirov ključ (npr. `customer_order_submitted`) — tako je
 * bilo pri uvođenju 0046 (revizija 2026-10-11, B3).
 */
const root = new URL("../../", import.meta.url);
const schema = await readFile(new URL("db/schema/notifications.ts", root), "utf8");
const labels = await readFile(new URL("lib/portal/status-labels.ts", root), "utf8");

test("svaka vrsta iz notification_kind ima naziv u NOTIFICATION_KIND_LABELS", () => {
  const block = schema.slice(schema.indexOf('pgEnum("notification_kind"'), schema.indexOf("]);", schema.indexOf('pgEnum("notification_kind"')));
  const kinds = [...block.matchAll(/^\s*"([a-z_]+)",/gm)].map((m) => m[1]);
  assert.ok(kinds.length >= 10, `pročitano ${kinds.length} vrsta`);
  const map = labels.slice(labels.indexOf("NOTIFICATION_KIND_LABELS"));
  for (const k of kinds) assert.match(map, new RegExp(`\\b${k}: "`), `nema naziva za ${k}`);
});
