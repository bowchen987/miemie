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

test("kind feeds paginate five posts at a time", async () => {
  const [app, html] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8")
  ]);

  assert.match(app, /const FEED_PAGE_SIZE = 5/);
  assert.match(app, /const PAGINATED_FILTERS = new Set\(\["todo", "resource", "message"\]\)/);
  assert.match(app, /state\.posts\.slice\(startIndex, startIndex \+ FEED_PAGE_SIZE\)/);
  assert.match(app, /resetFeedPage\(\)/);
  assert.match(html, /id="feedPager"/);
  assert.match(html, /id="previousPageButton"/);
  assert.match(html, /id="nextPageButton"/);
  assert.match(html, /id="feedPageStatus"/);
});

test("memo quick action uses the selected brain icon", async () => {
  const [html, styles] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /data-compose-kind="message"[\s\S]*class="action-icon memo-icon"/);
  assert.match(html, /class="memo-brain-left"/);
  assert.match(html, /class="memo-brain-sparkle"/);
  assert.doesNotMatch(html, /<span class="action-icon">✉<\/span>/);
  assert.match(styles, /\.memo-icon svg\s*\{[^}]*width:\s*31px[^}]*height:\s*31px/s);
});
