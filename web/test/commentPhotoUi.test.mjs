import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("comment photo input covers the visible camera button for tapping", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const match = styles.match(/\.comment-photo-field input\s*\{(?<body>[^}]+)\}/);

  assert.ok(match, "comment photo input styles should exist");
  const body = match.groups.body;

  assert.match(body, /inset:\s*0\b/);
  assert.match(body, /width:\s*100%/);
  assert.match(body, /height:\s*100%/);
  assert.doesNotMatch(body, /pointer-events:\s*none/);
});

test("comment photo selection shows visible feedback before sending", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /comment-photo-preview/);
  assert.match(app, /已选照片，点回复发送/);
  assert.match(app, /照片处理中/);
  assert.match(styles, /\.comment-photo-preview/);
  assert.match(styles, /\.comment-form-feedback/);
});

test("uploaded photos are prepared before sending to avoid oversized iPhone originals", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /const UPLOAD_IMAGE_MAX_EDGE\s*=/);
  assert.match(app, /function prepareImageForUpload/);
  assert.match(app, /canvas\.toDataURL\("image\/jpeg"/);
  assert.match(app, /const dataUrl = await prepareImageForUpload\(file\)/);
});

test("comment photo selection is refreshed after returning from the camera", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /commentPhotoRefreshers/);
  assert.match(app, /refreshCommentPhotoSelections/);
  assert.match(app, /photoInput\.addEventListener\("input"/);
  assert.match(app, /photoInput\.addEventListener\("change"/);
  assert.match(app, /window\.addEventListener\("focus", refreshCommentPhotoSelections\)/);
  assert.match(app, /window\.addEventListener\("pageshow", refreshCommentPhotoSelections\)/);
});

test("resume refresh does not remove a pending comment photo selection", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /function hasPendingCommentPhotoSelection\(\)/);
  assert.match(app, /function isCommentPhotoPickerReturning\(\)/);
  assert.match(
    app,
    /if \(hasPendingCommentPhotoSelection\(\) \|\| isCommentPhotoPickerReturning\(\)\) \{\s*refreshCommentPhotoSelections\(\);\s*settleCommentPhotoPickerReturn\(\);\s*return;\s*\}/s
  );
  assert.match(app, /return Boolean\(photoInput\.files\[0\]\)/);
  assert.match(app, /photoInput\.addEventListener\("click", markCommentPhotoPickerOpened\)/);
});
