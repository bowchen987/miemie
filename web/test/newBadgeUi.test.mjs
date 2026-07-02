import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post cards render unread activity with a visible new badge", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /const POST_READ_STATE_KEY = "miemie\.postReadState"/);
  assert.match(app, /function shouldShowNewBadge\(post\)/);
  assert.match(app, /function latestPostActivity\(post\)/);
  assert.match(app, /newBadge\.className = "post-new-badge"/);
  assert.match(app, /newBadge\.textContent = "NEW"/);
  assert.match(app, /card\.classList\.add\("is-new"\)/);
  assert.match(styles, /\.post-new-badge/);
  assert.match(styles, /\.post-card\.is-new/);
});

test("post cards clear unread activity after the user sees them", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function watchNewPostCard\(card, post\)/);
  assert.match(app, /new IntersectionObserver/);
  assert.match(app, /markPostActivityRead\(post\)/);
  assert.match(app, /localStorage\.setItem\(POST_READ_STATE_KEY/);
  assert.match(app, /card\.classList\.remove\("is-new"\)/);
});
