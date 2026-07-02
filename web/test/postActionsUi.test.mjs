import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post actions are revealed by swiping left and use icon buttons", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /const POST_ACTION_SWIPE_THRESHOLD\s*=/);
  assert.match(app, /function attachPostActionMenu\(card, post\)/);
  assert.match(app, /card\.addEventListener\("pointerdown"/);
  assert.match(app, /card\.addEventListener\("pointermove"/);
  assert.match(app, /card\.addEventListener\("pointerup"/);
  assert.match(app, /function showPostActionMenu\(card\)/);
  assert.match(app, /function hidePostActionMenu\(card\)/);
  assert.match(app, /function togglePinPost\(post\)/);
  assert.match(app, /function editPost\(post\)/);
  assert.match(app, /async function deletePost\(post\)/);
  assert.match(app, /editButton\.textContent = "✏️"/);
  assert.match(app, /pinButton\.textContent = "📌"/);
  assert.match(app, /deleteButton\.textContent = "🗑"/);
  assert.match(app, /editButton\.setAttribute\("aria-label", "编辑"\)/);
  assert.match(app, /pinButton\.setAttribute\("aria-label", post\.pinnedAt \? "取消置顶" : "置顶"\)/);
  assert.match(app, /deleteButton\.setAttribute\("aria-label", "删除"\)/);
  assert.match(app, /startX - event\.clientX >= POST_ACTION_SWIPE_THRESHOLD/);
  assert.match(styles, /\.post-actions\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.post-card\.action-menu-open \.post-actions/);
  assert.match(styles, /touch-action:\s*pan-y/);
  assert.match(styles, /\.post-actions button\s*\{[^}]*width:\s*52px/s);
});

test("post content slides aside while action buttons stay revealed", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /function wrapPostCardContent\(card\)/);
  assert.match(app, /content\.className = "post-card-content"/);
  assert.match(app, /wrapPostCardContent\(card\);\s*const actions = document\.createElement\("div"\)/);
  assert.match(styles, /\.post-card-content\s*\{[^}]*transition:\s*transform 160ms ease/s);
  assert.match(styles, /\.post-card\.action-menu-open \.post-card-content\s*\{[^}]*transform:\s*translateX\(var\(--post-action-offset\)\)/s);
});

test("post action buttons use larger icons with distinct colors", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /editButton\.className = "edit-action"/);
  assert.match(app, /pinButton\.className = "pin-action"/);
  assert.match(app, /deleteButton\.className = "delete-action"/);
  assert.match(styles, /\.post-actions button\s*\{[^}]*width:\s*52px[\s\S]*height:\s*52px[\s\S]*font-size:\s*26px/s);
  assert.match(styles, /\.post-actions \.edit-action\s*\{[^}]*background:[\s\S]*font-size:\s*26px/s);
  assert.match(styles, /\.post-actions \.pin-action\s*\{[^}]*background:/s);
  assert.match(styles, /\.post-actions \.delete-action\s*\{[^}]*background:/s);
});

test("post action menu closes from a right swipe", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /deltaX <= -POST_ACTION_SWIPE_THRESHOLD[\s\S]*hidePostActionMenu\(card\)/);
});

test("post action menu eats any non-action click after it is open", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /document\.addEventListener\("click", closePostActionMenuFromAnyClick, true\)/);
  assert.match(app, /function closePostActionMenuFromAnyClick\(event\)/);
  assert.match(app, /if \(isPostActionControlTarget\(event\.target\)\)[\s\S]*return;/);
  assert.match(app, /if \(Date\.now\(\) < postActionClickSuppressUntil\)[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);/);
  assert.match(app, /hideActivePostActionMenu\(\);[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);/);
  assert.doesNotMatch(app, /suppressNextClick/);
});

test("pinned posts render with a red pin marker", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /card\.classList\.toggle\("is-pinned", Boolean\(post\.pinnedAt\)\)/);
  assert.match(app, /api\(`\/api\/posts\/\$\{encodeURIComponent\(post\.id\)\}\/pin`/);
  assert.match(styles, /\.post-card\.is-pinned::after\s*\{[^}]*content:\s*"📌"/s);
  assert.match(styles, /\.post-card\.is-pinned::after\s*\{[^}]*left:\s*8px/s);
  assert.match(styles, /\.post-card\.is-pinned::after\s*\{[^}]*color:\s*#f25f5c/s);
});

test("editing posts reuses the composer and sends PATCH requests", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /editingPostId:\s*null/);
  assert.match(app, /elements\.postSubmitButton\.textContent = "保存修改"/);
  assert.match(app, /api\(`\/api\/posts\/\$\{encodeURIComponent\(state\.editingPostId\)\}`/);
  assert.match(app, /method:\s*"PATCH"/);
  assert.match(app, /method:\s*"DELETE"/);
});
