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
  assert.match(app, /editButton\.textContent = "✎"/);
  assert.match(app, /pinButton\.textContent = "📌"/);
  assert.match(app, /deleteButton\.textContent = "🗑"/);
  assert.match(app, /editButton\.setAttribute\("aria-label", "编辑"\)/);
  assert.match(app, /pinButton\.setAttribute\("aria-label", post\.pinnedAt \? "取消置顶" : "置顶"\)/);
  assert.match(app, /deleteButton\.setAttribute\("aria-label", "删除"\)/);
  assert.match(app, /startX - event\.clientX >= POST_ACTION_SWIPE_THRESHOLD/);
  assert.match(styles, /\.post-actions\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.post-card\.action-menu-open \.post-actions/);
  assert.match(styles, /touch-action:\s*pan-y/);
  assert.match(styles, /\.post-actions button\s*\{[^}]*width:\s*36px/s);
});

test("post action menu closes from a card click or a right swipe", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /card\.classList\.contains\("action-menu-open"\)/);
  assert.match(app, /hidePostActionMenu\(card\);\s*event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);/s);
  assert.match(app, /deltaX <= -POST_ACTION_SWIPE_THRESHOLD[\s\S]*hidePostActionMenu\(card\)/);
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
