import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("today paper requests local day bounds only for the all feed", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function todayRangeParams\(\)/);
  assert.match(app, /if \(state\.filter === "all"\) \{\s*for \(const \[key, value\] of todayRangeParams\(\)\) \{\s*params\.set\(key, value\);\s*}\s*}/s);
  assert.match(app, /const start = new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\)\)/);
  assert.match(app, /const end = new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\) \+ 1\)/);
});
