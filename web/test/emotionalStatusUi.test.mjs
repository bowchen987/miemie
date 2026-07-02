import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("distance card separates warm status copy from raw sync details", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(html, /id="statusText"/);
  assert.match(html, /id="syncDetailText"/);
  assert.match(app, /elements\.statusText\.textContent = emotionalStatusText\(status\)/);
  assert.match(app, /elements\.syncDetailText\.textContent = syncDetailText\(status\)/);
  assert.match(styles, /\.sync-detail/);
});

test("warm status copy covers close, fresh, far, and stale location states", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /const EMOTIONAL_STATUS_COPY =/);
  assert.match(app, /function emotionalStatusText\(status\)/);
  assert.match(app, /今天也在彼此附近/);
  assert.match(app, /离得很近，小家很安心/);
  assert.match(app, /刚刚同步过位置/);
  assert.match(app, /位置是新鲜的，安心/);
  assert.match(app, /距离有点远，但小家在线/);
  assert.match(app, /远一点也没关系，miemie 在这里/);
  assert.doesNotMatch(app, /来过 miemie/);
  assert.match(app, /小家还在等第一次定位/);
});

test("warm status copy is selected from a stable daily key", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function pickStatusCopy\(group, key\)/);
  assert.match(app, /function stableStatusCopyIndex\(key, count\)/);
  assert.match(app, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});
