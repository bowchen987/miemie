import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("startup failures keep a visible recovery path instead of crashing the app", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /init\(\)\.catch\(showStartupError\)/);
  assert.match(app, /function showStartupError\(error\)/);
  assert.match(app, /function createStartupRecoveryPanel\(\)/);
  assert.match(app, /await clearAppShellCaches\(\)/);
  assert.match(app, /window\.location\.reload\(\)/);
});

test("new scripts remain compatible with an older cached page shell", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /previousPageButton\?\.addEventListener/);
  assert.match(app, /nextPageButton\?\.addEventListener/);
  assert.match(app, /if \(!elements\.feedPager \|\|/);
  assert.doesNotMatch(app, /crypto\.randomUUID\(\)\s*,/);
  assert.match(app, /function createMemberId\(\)/);
});

test("app shell assets are versioned together and GET requests recover from transient failures", async () => {
  const [app, html, sw] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /href="\/styles\.css\?v=34"/);
  assert.match(html, /src="\/app\.js\?v=34"/);
  assert.match(app, /notificationUi\.js\?v=34/);
  assert.match(app, /timeFormat\.js\?v=34/);
  assert.match(app, /async function fetchApiResponseWithRetry/);
  assert.match(app, /const attempts = method === "GET" \? 2 : 1/);
  assert.match(app, /网络连接失败，请检查网络后重试/);
  assert.match(sw, /const CACHE_NAME = "miemie-pwa-v34"/);
  assert.match(sw, /"\/app\.js\?v=34"/);
  assert.match(sw, /"\/styles\.css\?v=34"/);
});
