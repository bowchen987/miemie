import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("filter tabs include badge placeholders for todo, resource, and message counts", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(html, /data-filter-badge="todo"/);
  assert.match(html, /data-filter-badge="resource"/);
  assert.match(html, /data-filter-badge="message"/);
  assert.doesNotMatch(html, /data-filter-badge="all"/);
  assert.match(styles, /\.filter-badge/);
  assert.match(styles, /\.filter-badge\[hidden\]/);
});

test("filter tab badges count unfinished todos and unread resources or messages", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /async function loadFilterBadges\(\)/);
  assert.match(app, /function filterBadgeCounts\(\)/);
  assert.match(app, /todoStatus === "incomplete"/);
  assert.match(app, /function unreadPostCount\(posts\)/);
  assert.match(app, /function renderFilterBadges\(\)/);
  assert.match(app, /data-filter-badge/);
  assert.match(app, /await Promise\.all\(\[loadPosts\(\), loadStatus\(\), loadFilterBadges\(\)\]\)/);
});

test("unread message badges include newer comment activity", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function latestCommentActivity\(post\)/);
  assert.match(app, /post\.comments/);
  assert.match(app, /type: "comment-added"/);
});
