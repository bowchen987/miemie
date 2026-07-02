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
