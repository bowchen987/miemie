import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cold start refresh also attempts the opted-in current location sync", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /await refreshAll\(\);\s*await syncCurrentLocation\(\{ quiet: true, requireOptIn: true \}\);\s*lastResumeRefreshAt = Date\.now\(\);/s
  );
});

test("foreground restore uses pageshow as a location sync trigger", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /window\.addEventListener\("pageshow", refreshAfterResume\)/);
});

test("camera reply protection keeps location sync active when returning to the app", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /if \(hasPendingCommentPhotoSelection\(\) \|\| isCommentPhotoPickerReturning\(\)\) \{\s*refreshCommentPhotoSelections\(\);\s*settleCommentPhotoPickerReturn\(\);\s*await syncCurrentLocation\(\{ quiet: true, requireOptIn: true \}\);\s*return;\s*\}/s
  );
});
