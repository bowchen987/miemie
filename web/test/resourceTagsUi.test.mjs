import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("resource feed includes archive search and tag filters", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /id="resourceArchiveTools"/);
  assert.match(html, /id="resourceSearchInput"/);
  assert.match(html, /id="resourceTagFilters"/);
  assert.match(styles, /\.resource-archive-tools/);
  assert.match(styles, /\.resource-tag-chip/);
  assert.match(app, /async function loadTags\(\)/);
  assert.match(app, /function renderResourceArchiveTools\(\)/);
  assert.match(app, /resourceTagFilter/);
  assert.match(app, /params\.set\("tagId", state\.resourceTagFilter\)/);
  assert.match(app, /params\.set\("q", state\.resourceSearch\)/);
});

test("resource composer supports selecting multiple tags and creating tags", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /id="resourceTagPicker"/);
  assert.match(html, /id="composerTagList"/);
  assert.match(html, /id="newTagInput"/);
  assert.match(html, /id="createTagButton"/);
  assert.match(app, /function renderComposerTagPicker\(\)/);
  assert.match(app, /function selectedResourceTagIds\(\)/);
  assert.match(app, /tagIds:\s*selectedResourceTagIds\(\)/);
  assert.match(app, /async function createResourceTagFromComposer\(\)/);
  assert.match(app, /async function renameResourceTag\(tag\)/);
  assert.match(app, /async function deleteResourceTag\(tag\)/);
});

test("tag edit and delete controls live in the resource composer, not the filter bar", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /elements\.resourceTagFilters\.append\(resourceTagFilterButton\(tag\.id, tag\.name\)\)/);
  assert.doesNotMatch(app, /elements\.resourceTagFilters\.append\(resourceTagFilterGroup\(tag\)\)/);
  assert.match(app, /function resourceTagManagementGroup\(tag\)/);
  assert.match(app, /elements\.composerTagList\.append\(resourceTagManagementGroup\(tag\)\)/);
});

test("resource cards render tag chips while non-resource cards omit tag controls", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(app, /function renderPostTags\(post\)/);
  assert.match(app, /RESOURCE_KINDS\.has\(post\.kind\)/);
  assert.match(app, /post\.tagIds/);
  assert.match(styles, /\.post-tags/);
  assert.match(styles, /\.post-tag/);
});
