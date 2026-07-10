import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cold start refresh attempts current location sync without a local opt-in flag", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /await refreshAll\(\);\s*await syncCurrentLocation\(\{ quiet: true \}\);\s*lastResumeRefreshAt = Date\.now\(\);/s
  );
  assert.doesNotMatch(app, /miemie\.locationAutoSyncEnabled/);
  assert.doesNotMatch(app, /requireOptIn/);
});

test("foreground restore uses pageshow as a location sync trigger", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /window\.addEventListener\("pageshow", refreshAfterResume\)/);
});

test("camera reply protection keeps location sync active when returning to the app", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /if \(hasPendingCommentPhotoSelection\(\) \|\| isCommentPhotoPickerReturning\(\)\) \{\s*refreshCommentPhotoSelections\(\);\s*settleCommentPhotoPickerReturn\(\);\s*await syncCurrentLocation\(\{ quiet: true \}\);\s*return;\s*\}/s
  );
});

test("distance card includes a cute reminder button for asking the other member to sync", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(html, /id="remindSyncButton"/);
  assert.match(html, />戳一戳</);
  assert.match(app, /remindSyncButton: document\.querySelector\("#remindSyncButton"\)/);
  assert.match(app, /elements\.remindSyncButton\.addEventListener\("click", remindLocationSync\)/);
  assert.match(app, /api\("\/api\/location-reminders"/);
  assert.match(styles, /\.remind-sync-button/);
  assert.match(styles, /\.status-actions \.remind-sync-button\s*\{[^}]*margin-left:\s*auto/s);
  assert.match(styles, /\.remind-sync-button::before/);
});
