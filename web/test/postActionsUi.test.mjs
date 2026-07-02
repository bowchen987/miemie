import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post edit and delete actions are hidden until a long press opens them", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /const POST_ACTION_LONG_PRESS_MS\s*=/);
  assert.match(app, /function attachPostActionMenu\(card, post\)/);
  assert.match(app, /card\.addEventListener\("pointerdown"/);
  assert.match(app, /card\.addEventListener\("pointerup"/);
  assert.match(app, /function showPostActionMenu\(card\)/);
  assert.match(app, /function hidePostActionMenu\(card\)/);
  assert.match(app, /function editPost\(post\)/);
  assert.match(app, /async function deletePost\(post\)/);
  assert.match(styles, /\.post-actions\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(styles, /\.post-card\.action-menu-open \.post-actions/);
});

test("editing posts reuses the composer and sends PATCH requests", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /editingPostId:\s*null/);
  assert.match(app, /elements\.postSubmitButton\.textContent = "保存修改"/);
  assert.match(app, /api\(`\/api\/posts\/\$\{encodeURIComponent\(state\.editingPostId\)\}`/);
  assert.match(app, /method:\s*"PATCH"/);
  assert.match(app, /method:\s*"DELETE"/);
});
