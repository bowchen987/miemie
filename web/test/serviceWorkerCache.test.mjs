import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("service worker caches uploaded media without caching API responses", async () => {
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(sw, /const UPLOAD_CACHE_PATH_PREFIX = "\/uploads\/"/);
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/api\/"\)\) \{\s*return;\s*\}/);
  assert.doesNotMatch(sw, /url\.pathname\.startsWith\("\/api\/"\) \|\| url\.pathname\.startsWith\("\/uploads\/"\)/);
  assert.match(sw, /if \(url\.pathname\.startsWith\(UPLOAD_CACHE_PATH_PREFIX\)\) \{\s*event\.respondWith\(cacheUploadedAsset\(event\.request\)\);\s*return;\s*\}/);
  assert.match(sw, /async function cacheUploadedAsset\(request\)/);
  assert.match(sw, /const cached = await caches\.match\(request\)/);
  assert.match(sw, /await cache\.put\(request, response\.clone\(\)\)/);
});
